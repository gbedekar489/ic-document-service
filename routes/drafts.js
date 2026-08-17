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
      AND _techmarketingdemos.email IS NOT NULL
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
router.post("/api/drafts/send-nudge", async (req, res) => {
  try {
    const { ownerId, formId } = req.body;

    if (!ownerId || !formId) {
      return res.status(400).json({
        error: "ownerId and formId are required"
      });
    }

    const dataStreamId = process.env.AEP_DATASTREAM_ID;
    const orgId = process.env.AEP_ORG_ID;
    const apiKey = process.env.AEP_API_KEY;
    const token = process.env.AEP_IMS_TOKEN;

    if (!dataStreamId || !orgId || !apiKey || !token) {
      return res.status(500).json({
        error: "Missing AEP configuration"
      });
    }

    const payload = {
      event: {
        xdm: {
          eventType: "form.nudge",
          timestamp: new Date().toISOString(),

          identityMap: {
            Auth0Owner: [
              {
                id: ownerId,
                authenticatedState: "ambiguous",
                primary: true
              }
            ]
          },

          _techmarketingdemos: {
            formId: formId
          }
        }
      }
    };

    console.log(
      "Sending form.nudge event:",
      JSON.stringify(payload, null, 2)
    );

    const url =
      `https://server.adobedc.net/ee/v2/interact` +
      `?dataStreamId=${encodeURIComponent(dataStreamId)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
        "x-gw-ims-org-id": orgId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    console.log(`AEP status: ${response.status}`);
    console.log(`AEP response: ${responseText}`);

    if (!response.ok) {
      return res.status(502).json({
        error: "AEP form.nudge event failed",
        status: response.status,
        details: responseText
      });
    }

    return res.json({
      success: true,
      message: "form.nudge event sent successfully",
      ownerId,
      formId,
      aepResponse: responseText
    });

  } catch (err) {
    console.error("form.nudge error:", err);

    return res.status(500).json({
      error: err.message
    });
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
              <th>Saved At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <script>
        async function loadDrafts() {
  const response = await fetch("/api/drafts");
  const drafts = await response.json();

  const tbody = document.querySelector("#draftTable tbody");
  tbody.innerHTML = "";

  drafts.forEach(d => {
    tbody.innerHTML += \`
      <tr>
        <td>\${d.formname || ""}</td>
        <td>\${d.email || ""}</td>
         <td>\${formatSavedAt(d.savedat)}</td>
        <td>
          <button
            class="reminder-button"
            data-owner="\${d.ownerid || ""}"
            data-form="\${d.formname || ""}">
            Send Reminder
          </button>
        </td>
      </tr>
    \`;
  });

  // Attach listeners AFTER the buttons exist
  document.querySelectorAll(".reminder-button").forEach(button => {
    button.addEventListener("click", async function () {

      const ownerId = this.dataset.owner;
      const formId = this.dataset.form;

      console.log("Send Reminder button clicked");
      console.log("ownerId:", ownerId);
      console.log("formId:", formId);

      try {
        console.log("Calling /api/drafts/send-nudge...");

        const response = await fetch("/api/drafts/send-nudge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ownerId,
            formId
          })
        });

        console.log("Backend response status:", response.status);

        const result = await response.json();

        console.log("Backend response:", result);

        if (!response.ok) {
          throw new Error(result.error || "Failed to send nudge");
        }

        alert("Reminder email sent");
      } catch (err) {
        console.error("Nudge failed:", err);
        alert("Failed to trigger nudge: " + err.message);
      }
    });
  });
}
function formatSavedAt(value) {
  if (!value) return "";

  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
loadDrafts();

      </script>
    </body>
    </html>
  `);
});

module.exports = router;