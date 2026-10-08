const express = require("express");
//const fs = require("fs");
//const path = require("path");
const FormData = require("form-data");

const router = express.Router();

const AEM_BASE_URL =
  "https://author-p133654-e1305513.adobeaemcloud.com";

/* const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "templates",
  "RegistrationForm.pdf"
);
 */
function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createRegistrationXml(requestBody) {
  const data =
    requestBody?.registrationapplication ||
    requestBody ||
    {};

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

router.post("/", async (req, res) => {
  try {
    
    const data =
      req.body?.registrationapplication ||
      req.body ||
      {};
console.log(
  "RAW REQUEST BODY:",
  JSON.stringify(req.body, null, 2)
);
    console.log("PDF request fields:", {
      fname: data.fname,
      lname: data.lname,
      email: data.email,
      mobileNumber: data.mobileNumber,
      registrationStartDate: data.registrationStartDate,
      employment: data.employment
    });

    const xml = createRegistrationXml(req.body);

    console.log("Generated XML:");
    console.log(xml);
 

    const formData = new FormData();
    // Template is the AEM template name
formData.append(
  "template",
  "RegistrationForm.pdf"
);

/* const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

formData.append(
  "template",
  templateBuffer,
  {
    filename: "RegistrationForm.pdf",
    contentType: "application/pdf"
  }
) */;
 const options = {
  locale: "en",
  isTagged: true,
  embedFonts: true,
  linearizedPDF: true,
  retainFormState: false,
  retainUnsignedSignatureFields: false,
  acrobatVersion: "Acrobat_11",
  contentRoot:
    "crx:///content/dam/formsanddocuments"
};

formData.append(
  "options",
  JSON.stringify(options)
);

formData.append(
  "data",
  Buffer.from(xml, "utf8")
);
    const authorizationHeader =
      process.env.Authorization_Header;

    if (!authorizationHeader) {
      return res.status(500).json({
        error:
          "Authorization_Header environment variable is not configured"
      });
    }

    const aemUrl =
      `${AEM_BASE_URL}/adobe/document/generate/pdfform`;

    const response = await fetch(aemUrl, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
        "X-Adobe-Accept-Experimental": "1",
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "AEM PDF generation failed:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        error: "AEM PDF generation failed",
        status: response.status,
        details: errorText
      });
    }

    const pdfBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    console.log(
      `Generated PDF: ${pdfBuffer.length} bytes`
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
      error: "Unable to generate registration PDF",
      message: error.message
    });
  }
});

module.exports = router;