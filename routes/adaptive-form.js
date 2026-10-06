const express = require("express");
const router = express.Router();

const AEM_BASE_URL =
  "https://publish-p133654-e1305513.adobeaemcloud.com";

const FORM_ID =
  "L2NvbnRlbnQvZm9ybXMvYWYvYmFua2luZ2Zvcm1zL3JlZ2lzdHJhdGlvbmZvcm0=";


// --------------------------------------------------
// GET Adaptive Form
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const aemUrl =
      `${AEM_BASE_URL}/adobe/forms/af/${FORM_ID}`;

    console.log("Fetching Adaptive Form:", aemUrl);

    const response = await fetch(aemUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "AEM GET error:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        error: "Unable to fetch Adaptive Form",
        status: response.status
      });
    }

    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error("Adaptive Form GET error:", error);

    res.status(500).json({
      error: "Unable to fetch Adaptive Form",
      message: error.message
    });
  }
});


// --------------------------------------------------
// POST Adaptive Form
// --------------------------------------------------

router.post("/submit", async (req, res) => {
  try {

    const submitUrl =
      `${AEM_BASE_URL}/adobe/forms/af/submit/${FORM_ID}`;

    console.log("Submitting Adaptive Form to:", submitUrl);
    console.log("Form data:", req.body);

    const response = await fetch(submitUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },

      body: JSON.stringify({
  data: req.body
})
    });

    const responseText = await response.text();

    console.log("AEM submit status:", response.status);
    console.log("AEM submit response:", responseText);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "AEM form submission failed",
        status: response.status,
        details: responseText
      });
    }

    return res.status(200).json({
      success: true,
      status: response.status,
      message: "Form submitted successfully",
      aemResponse: responseText
    });

  } catch (error) {

    console.error(
      "Adaptive Form submission error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Unable to submit Adaptive Form",
      message: error.message
    });
  }
});


module.exports = router;