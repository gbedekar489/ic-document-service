const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

const SIGN_API =
  "https://api.na1.echosign.com/api/rest/v6";

// Generate PDF and upload to Acrobat Sign
router.post("/transient", async (req, res) => {
  try {
    // 1. Generate PDF using our existing Node endpoint
    const pdfResponse = await axios.post(
      "http://localhost:" +
        (process.env.PORT || 3000) +
        "/api/registration-document",
      req.body,
      {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const pdfBuffer = Buffer.from(pdfResponse.data);

    // Verify PDF
    if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("AEM did not return a valid PDF");
    }

    console.log("Generated PDF bytes:", pdfBuffer.length);

    // 2. Upload PDF to Acrobat Sign
    const formData = new FormData();

    formData.append(
      "File",
      pdfBuffer,
      {
        filename: "RegistrationApplication.pdf",
        contentType: "application/pdf"
      }
    );

    formData.append(
      "File-Name",
      "RegistrationApplication.pdf"
    );

    formData.append(
      "Mime-Type",
      "application/pdf"
    );

    const signResponse = await axios.post(
      `${SIGN_API}/transientDocuments`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization:
            `Bearer ${process.env.ADOBE_SIGN_INTEGRATION_KEY}`
        },
        maxBodyLength: Infinity
      }
    );

    // 3. Return transient document ID
    return res.json({
      success: true,
      transientDocumentId:
        signResponse.data.transientDocumentId
    });

  } catch (error) {
    console.error(
      "Acrobat Sign transient upload failed:",
      error.response?.status || error.message
    );

    return res.status(502).json({
      success: false,
      error: "Unable to prepare document for signing"
    });
  }
});

module.exports = router;