const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

const AEM_BASE_URL =
  "https://author-p133654-e1305513.adobeaemcloud.com";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createRegistrationXml(data) {
  return `<form1>
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
    console.log(
      "RAW REQUEST BODY:",
      JSON.stringify(req.body, null, 2)
    );

    const data =
      req.body?.registrationapplication ||
      req.body ||
      {};

    console.log("PDF request fields:", {
      fname: data.fname,
      lname: data.lname,
      email: data.email,
      mobileNumber: data.mobileNumber,
      registrationStartDate: data.registrationStartDate,
      employment: data.employment
    });

    const xml = createRegistrationXml(data);

    console.log("Generated XML:");
    console.log(xml);

    const authorizationHeader =
      process.env.Authorization_Header;

    if (!authorizationHeader) {
      return res.status(500).json({
        error:
          "Authorization_Header environment variable is not configured"
      });
    }

    const aemUrl =
      `${AEM_BASE_URL}/adobe/forms/doc/v1/generatePDFOutput`;

    console.log("Template:", "RegistrationForm.pdf");

    console.log(
      "ContentRoot:",
      "crx:///content/dam/formsanddocuments"
    );

    console.log(
      "XML bytes:",
      Buffer.byteLength(xml, "utf8")
    );

    // Build multipart request
    const formData = new FormData();

    formData.append(
      "template",
      "RegistrationForm.pdf"
    );

    formData.append(
      "data",
      Buffer.from(xml, "utf8"),
      {
        filename: "registrationData.xml",
        contentType: "application/xml"
      }
    );

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

    console.log("Calling AEM PDF generation API...");

    const response = await axios.post(
      aemUrl,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: authorizationHeader,
          "X-Adobe-Accept-Experimental": "1"
        },

        responseType: "arraybuffer",

        maxBodyLength: Infinity,
        maxContentLength: Infinity,

        validateStatus: () => true
      }
    );

    console.log(
      "AEM PDF generation status:",
      response.status
    );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      const errorText =
        Buffer.from(response.data).toString("utf8");

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

    const pdfBuffer =
      Buffer.from(response.data);

    console.log(
      "Generated PDF size:",
      pdfBuffer.length,
      "bytes"
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

    return res.send(pdfBuffer);

  } catch (error) {
    console.error(
      "Registration PDF error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to generate registration PDF",
      message:
        error.message
    });
  }
});

module.exports = router;