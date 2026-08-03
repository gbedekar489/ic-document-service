const express = require("express");
const { Client } = require("pg");

const router = express.Router();

async function getDraftForms() {
  const client = new Client({
    host: process.env.AEP_QUERY_HOST,
    port: Number(process.env.AEP_QUERY_PORT),
    database: process.env.AEP_QUERY_DATABASE,
    user: process.env.AEP_QUERY_USER,
    password: process.env.AEP_QUERY_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const result = await client.query(`
    SELECT
      _techmarketingdemos.formname,
      _techmarketingdemos.email,
      _techmarketingdemos.ownerid,
      _techmarketingdemos.savedat
    FROM formsportalstatus_v2_20260731_172643_669
    WHERE
      _techmarketingdemos.submitted = FALSE
      AND _techmarketingdemos.savedat IS NOT NULL
    ORDER BY _techmarketingdemos.savedat DESC
  `);

  await client.end();
  return result.rows;
}

router.get("/api/drafts", async (req, res) => {
  try {
    const drafts = await getDraftForms();
    res.json(drafts);
  } catch (err) {
    console.error("Failed to load drafts:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/drafts", async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Forms Saved As Draft</title>
      <link rel="stylesheet" href="https://unpkg.com/@spectrum-css/spectrum@3.1.0/dist/spectrum-core.css">
      <style>
        body{font-family:Arial;margin:40px;background:#f5f5f5;}
        .container{background:white;padding:30px;border-radius:8px;}
        table{width:100%;border-collapse:collapse;margin-top:20px;}
        th{text-align:left;background:#1473e6;color:white;padding:12px;}
        td{padding:10px;border-bottom:1px solid #ddd;}
        input{width:300px;padding:10px;font-size:15px;}
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Forms Saved As Draft</h2>
        <input type="text" id="search" placeholder="Search by email or form name">
        <table id="draftTable">
          <thead>
            <tr>
              <th>Form Name</th>
              <th>Email</th>
              <th>Owner</th>
              <th>Saved At</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <script>
        async function loadDrafts() {
          const response = await fetch('/api/drafts');
          const drafts = await response.json();
          const tbody = document.querySelector("#draftTable tbody");
          tbody.innerHTML = "";

          drafts.forEach(d => {
            tbody.innerHTML += \`
              <tr>
                <td>\${d.formname || ""}</td>
                <td>\${d.email || ""}</td>
                <td>\${d.ownerid || ""}</td>
                <td>\${d.savedat ? new Date(d.savedat).toLocaleString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
}) : ""}</td>
              </tr>
            \`;
          });
        }

        document.getElementById("search").addEventListener("keyup", function () {
          const value = this.value.toLowerCase();
          document.querySelectorAll("#draftTable tbody tr").forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? "" : "none";
          });
        });

        loadDrafts();
      </script>
    </body>
    </html>
  `);
});

module.exports = router;