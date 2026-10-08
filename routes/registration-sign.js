const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

const SIGN_API =
  "https://api.na1.echosign.com/api/rest/v6";


// --------------------------------------------------
// Generate PDF -> Upload -> Create Widget -> Get URL
// --------------------------------------------------

router.post("/transient", async (req, res) => {
  try {

    // --------------------------------------------------
    // 1. Generate the PDF using our existing endpoint
    // --------------------------------------------------

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

    const pdfBuffer =
      Buffer.from(pdfResponse.data);

    if (
      pdfBuffer.subarray(0, 5).toString() !==
      "%PDF-"
    ) {
      throw new Error(
        "AEM did not return a valid PDF"
      );
    }

    console.log(
      "Generated PDF bytes:",
      pdfBuffer.length
    );


    // --------------------------------------------------
    // 2. Upload PDF to Acrobat Sign
    // --------------------------------------------------

    const formData = new FormData();

    formData.append(
      "File",
      pdfBuffer,
      {
        filename:
          "RegistrationApplication.pdf",

        contentType:
          "application/pdf"
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

console.log("=== ABOUT TO UPLOAD PDF TO ACROBAT SIGN ===");
    const signResponse =
      await axios.post(
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


    const transientDocumentId =
      signResponse.data.transientDocumentId ||
      signResponse.data.id;


    if (!transientDocumentId) {
      throw new Error(
        "Acrobat Sign did not return a transient document ID"
      );
    }


    console.log(
      "Transient Document ID:",
      transientDocumentId
    );

console.log("=== ABOUT TO CREATE WIDGET ===");
    // --------------------------------------------------
    // 3. Create Acrobat Sign Widget
    // --------------------------------------------------

    const widgetPayload = {

      fileInfos: [
        {
          transientDocumentId
        }
      ],

      name:
        "Registration Application",

      state:
        "ACTIVE",

      widgetParticipantSetInfo: {

        memberInfos: [
          {
            email: ""
          }
        ],

        role:
          "SIGNER"
      }
    };


    const widgetResponse =
      await axios.post(
        `${SIGN_API}/widgets`,
        widgetPayload,
        {
          headers: {
            Authorization:
              `Bearer ${process.env.ADOBE_SIGN_INTEGRATION_KEY}`,

            "Content-Type":
              "application/json"
          }
        }
      );


    const widgetId =
      widgetResponse.data.id;


    if (!widgetId) {
      throw new Error(
        "Acrobat Sign did not return a widget ID"
      );
    }


    console.log(
      "Widget ID:",
      widgetId
    );


    // --------------------------------------------------
    // 4. Get Widget Document View URL
    // --------------------------------------------------

    const viewResponse =
      await axios.post(
        `${SIGN_API}/widgets/${widgetId}/views`,

        {
          name: "DOCUMENT"
        },

        {
          headers: {
            Authorization:
              `Bearer ${process.env.ADOBE_SIGN_INTEGRATION_KEY}`,

            "Content-Type":
              "application/json"
          }
        }
      );


    console.log(
      "Widget view response:",
      JSON.stringify(
        viewResponse.data,
        null,
        2
      )
    );


    // --------------------------------------------------
    // 5. Extract URL
    // --------------------------------------------------

    const viewInfo =
      Array.isArray(viewResponse.data)
        ? viewResponse.data
        : viewResponse.data.widgetViewInfo;


    const documentView =
      viewInfo?.find(
        item => item.name === "DOCUMENT"
      ) ||
      viewInfo?.[0];


    const widgetUrl =
      documentView?.url;


    if (!widgetUrl) {
      throw new Error(
        "Acrobat Sign did not return a widget URL"
      );
    }


    console.log(
      "Widget URL created successfully"
    );


    // --------------------------------------------------
    // 6. Return everything to caller
    // --------------------------------------------------

    return res.json({
      success: true,

      transientDocumentId,

      widgetId,

      widgetUrl
    });


  } catch (error) {

    console.error(
      "Acrobat Sign flow failed:"
    );

    console.error(
      error.response?.status ||
        error.message
    );

    console.error(
      error.response?.data ||
        ""
    );


    return res.status(502).json({
      success: false,

      error:
        "Unable to create Acrobat Sign signing experience",

      status:
        error.response?.status,

      details:
        error.response?.data ||
        error.message
    });
  }
});


module.exports = router;