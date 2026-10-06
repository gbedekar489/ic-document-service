const express = require("express");
const router = express.Router();

const AEM_BASE_URL =
  "https://publish-p133654-e1305513.adobeaemcloud.com";

const FORM_ID =
  "L2NvbnRlbnQvZm9ybXMvYWYvYmFua2luZ2Zvcm1zL3JlZ2lzdHJhdGlvbmZvcm0=";

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

      console.error("AEM returned:", response.status, errorText);

      return res.status(response.status).json({
        error: "Unable to fetch Adaptive Form",
        status: response.status
      });
    }

    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error("Adaptive Form error:", error);

    res.status(500).json({
      error: "Unable to fetch Adaptive Form",
      message: error.message
    });
  }
});

module.exports = router;