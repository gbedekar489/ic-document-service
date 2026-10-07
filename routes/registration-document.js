const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const AEM_BASE_URL =
  "https://author-p133654-e1305513.adobeaemcloud.com";

const XDP_PATH =
  path.join(
    __dirname,
    "..",
    "templates",
    "RegistrationForm.pdf"
  );


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


function createRegistrationXml(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<form1>
    <registrationform>
        <fname>${escapeXml(data.fname)}</fname>
        <lname>${escapeXml(data.lname)}</lname>
        <email>${escapeXml(data.email)}</email>
        <mobileNumber>${escapeXml(data.mobileNumber)}</mobileNumber>
        <registrationStartDate>${escapeXml(data.registrationStartDate)}</registrationStartDate>
        <employment>${escapeXml(data.employment)}</employment>
    </registrationform>
</form1>`;
}


// --------------------------------------------------
// Generate PDF
// --------------------------------------------------

router.post("/", async (req, res) => {
  try {
    if (!fs.existsSync(XDP_PATH)) {
      return res.status(500).json({
        error: "RegistrationForm.xdp was not found"
      });
    }

    const data = req.body;

    console.log("Generating registration PDF");

    const xml = createRegistrationXml(data);

    const xdpBuffer =
      fs.readFileSync(XDP_PATH);

    /*
     * Node 18+ provides Blob/FormData.
     */
    const formData = new FormData();

    formData.append(
      "template",
      new Blob(
        [xdpBuffer],
        {
          type:
            "application/vnd.adobe.xdp+xml"
        }
      ),
      "RegistrationForm.xdp"
    );

    formData.append(
      "data",
      new Blob(
        [xml],
        {
          type: "application/xml"
        }
      ),
      "registrationData.xml"
    );


    const aemUrl =
      `${AEM_BASE_URL}/adobe/document/generate/pdfform`;

    const authorizationHeader =
      process.env.Authorization_Header;

    if (!authorizationHeader) {
      return res.status(500).json({
        error:
          "Authorization_Header environment variable is not configured"
      });
    }


    const response = await fetch(aemUrl, {
      method: "POST",

      headers: {
        Authorization: authorizationHeader,
        "X-Adobe-Accept-Experimental": "1"
      },

      body: formData
    });


    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "AEM PDF generation failed:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        error:
          "AEM PDF generation failed",
        status:
          response.status,
        details:
          errorText
      });
    }


    const pdfBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );


    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="RegistrationApplication.pdf"'
    );

    res.setHeader(
      "Content-Length",
      pdfBuffer.length
    );

    res.send(pdfBuffer);

  } catch (error) {

    console.error(
      "Registration PDF error:",
      error
    );

    res.status(500).json({
      error:
        "Unable to generate registration PDF",
      message:
        error.message
    });
  }
});


module.exports = router;