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
    // 1. Generate PDF using our existing endpoint
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

    console.log(
      "=== ABOUT TO UPLOAD PDF TO ACROBAT SIGN ==="
    );

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


    // --------------------------------------------------
    // 3. Create Acrobat Sign Widget
    // --------------------------------------------------

    console.log(
      "=== ABOUT TO CREATE WIDGET ==="
    );

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
    // 4. Get all Web Forms
    // --------------------------------------------------

    console.log(
      "=== LOOKING UP WIDGET URL ==="
    );

    const widgetsResponse =
      await axios.get(
        "https://secure.na1.echosign.com/api/rest/v6/widgets",
        {
          headers: {
            Accept:
              "application/json",

            "x-api-user":
              "email:girishbedekar@gmail.com",

            Authorization:
              `Bearer ${process.env.ADOBE_SIGN_INTEGRATION_KEY}`
          }
        }
      );


    const widgets =
      widgetsResponse.data.userWidgetList || [];


    console.log(
      "Number of widgets returned:",
      widgets.length
    );


    // --------------------------------------------------
    // 5. Find the widget we just created
    // --------------------------------------------------

    const matchingWidget =
      widgets.find(
        widget =>
          widget.id === widgetId
      );


    if (!matchingWidget) {
      throw new Error(
        `Could not find widget ${widgetId}`
      );
    }


    const widgetUrl =
      matchingWidget.url;
      

    if (!widgetUrl) {
      throw new Error(
        `Widget ${widgetId} does not have a URL`
      );
    }


    console.log(
      "Matching widget found:",
      widgetId
    );

    console.log(
      "Widget URL retrieved successfully"
    );


    // --------------------------------------------------
    // 6. Return result to browser
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