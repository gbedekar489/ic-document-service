const express = require("express");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const jsonServer = require("json-server");
const sgMail = require("@sendgrid/mail");

const app = express();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();
app.use(express.json());

// Serve static files first
app.use(express.static(path.join(__dirname)));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Your custom API routes here
// app.post('/generate-pdf-base64', ...)

// Mount json-server under /api only
const rewriter = jsonServer.rewriter(require("./routes.json"));
app.use("/api", middlewares);
app.use("/api", rewriter);
app.use("/api", router);

// Start server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const AEP_API_BASE = 'https://platform.adobe.io';
const ACCESS_TOKEN = process.env.AEP_ACCESS_TOKEN;      // set this in .env
const API_KEY = process.env.AEP_API_KEY;                // x-api-key
const ORG_ID = process.env.AEP_ORG_ID;                  // x-gw-ims-org-id
const SANDBOX = process.env.AEP_SANDBOX || '';          // optional x-sandbox-name
const SENDGRID_API_KEY = process.env.SEND_GRID_API_KEY;

// --- CONFIG (env) ---
const AEM_COMM_BASE =
  'https://author-p133654-e1305513.adobeaemcloud.com/adobe/communications';
const AEM_COMM_URL =  'https://author-p133654-e1305513.adobeaemcloud.com/adobe/communications/f35ea2d9-6164-4791-8943-c56a6085eb91/pdf';
const AEM_BEARER = 'Basic Z2VlYmVlOmFkbWlu';                // e.g. "Bearer eyJ..."
//const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;    // Optional: simple protection

// SendGrid config (required for /generate-and-send)

const SENDGRID_FROM = 'girishbedekar@outlook.com';         // verified sender e.g. "noreply@yourdomain.com"
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function buildHeaders() {
  const headers = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'x-api-key': API_KEY,
    'x-gw-ims-org-id': ORG_ID,
    'Content-Type': 'application/json'
  };
  if (SANDBOX) headers['x-sandbox-name'] = SANDBOX;
  return headers;
}
/**
 * GET /profile
 * Query params:
 *   ?email=someone@example.com     (look up by email identity namespace)
 *   OR
 *   ?xid=BVrq...                   (look up by profile XID)
 *
 * Example:
 *   GET /profile?email=joe%40example.com
 */
 app.get('/profile', async (req, res) => {
  try {
    const { email, xid } = req.query;

    if (!email && !xid) {
      return res.status(400).json({ error: 'Provide either ?email= or ?xid=' });
    }

    // fields can be adjusted to return exactly what you need
    const fields = [
      'personalEmail',
      '_techmarketingdemos.DocumentCloud',
      '_techmarketingdemos.ExperienceCloud',
      '_techmarketingdemos.ExperiencePlatform'
    ].join(',');

    let url = `${AEP_API_BASE}/data/core/ups/access/entities?schema.name=_xdm.context.profile&fields=${encodeURIComponent(fields)}`;

    if (xid) {
      url += `&entityId=${encodeURIComponent(xid)}`;
    } else {
      // assume email identity namespace
      url += `&entityId=${encodeURIComponent(email)}&entityIdNS=email`;
    }

    const response = await axios.get(url, { headers: buildHeaders() });

    // response data structure: { "<XID>": { entity: {...}, identities: [...], ... } }
    const data = response.data;
    const firstKey = Object.keys(data)[0];
    if (!firstKey || !data[firstKey].entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    res.json(data[firstKey].entity);

  } catch (err) {
    console.error('Error fetching profile:', err.response ? err.response.data : err.message);
    const status = err.response ? err.response.status : 500;
    res.status(status).json({
      error: 'Unable to fetch profile',
      details: err.response ? err.response.data : err.message
    });
  }
});

// Simple health-check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

/**
 * Helper: fetch PDF buffer from AEM Communications
 * returns: { buffer, status } or throws
 */
async function fetchPdfBuffer(documentId, serviceParams = {}) {
  const url = `https://author-p133654-e1305513.adobeaemcloud.com/adobe/communications/${documentId}/pdf`;
  const optionsJson = JSON.stringify({
    prefill: {
      serviceName: 'IC_FDM',
      serviceParams: serviceParams ||{}
    }
  });

  const form = new FormData();
  form.append('options', optionsJson, { contentType: 'application/json' });

  const resp = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: 'Basic Z2VlYmVlOmFkbWlu'
    },
    responseType: 'arraybuffer',
    validateStatus: null
  });

  if (resp.status < 200 || resp.status >= 300) {
    let bodyPreview = '';
    try { bodyPreview = Buffer.from(resp.data || '', 'binary').toString('utf8').slice(0, 400); } catch(e){ bodyPreview = '<non-text response>'; }
    const err = new Error('communications service error');
    err.status = resp.status;
    err.bodyPreview = bodyPreview;
    throw err;
  }

  return Buffer.from(resp.data);
}

app.get("/getOrdersByUser/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  const db = router.db; // lowdb instance
  const orders = db.get("orders").filter({ userId }).value();

  // Detect AEM: (1) explicit query flag ?_aem=1, (2) Accept header containing 'application/aem',
  // or (3) User-Agent containing 'AEM'. Adjust detection rules if needed.
  const accept = (req.headers["accept"] || "").toLowerCase();
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const isAem =
    req.query._aem === "1" ||
    accept.includes("application/aem") ||
    /aem/.test(ua);

  if (isAem) {
    // AEM-friendly: return raw array
    return res.json(orders);
  }

  // Default: backward-compatible wrapper
  return res.json({ orders });
});
app.get("/users/:userId/orders", (req, res) => {
  const userId = Number(req.params.userId);
  const db = router.db;
  const orders = db.get("orders").filter({ userId }).value();
  return res.json({ orders });
});

/**
 * POST /generate-pdf-base64
 * Body: { "userId": "12345" }
 * Headers: (if AEM_BEARER not set) Authorization: Bearer <AEM_TOKEN>
 */
app.post('/generate-pdf-base64', async (req, res) => {
  try {
    // optional internal auth
    const documentId = req.body.documentId || req.query.documentId;

    if (!documentId) {
      return res.status(400).json({ error: 'missing documentId' });
    }
    
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'missing userId' });

    const aemAuth = AEM_BEARER || req.header('Authorization');
    if (!aemAuth) return res.status(401).json({ error: 'missing AEM Authorization' });

    const aemUrl = `${AEM_COMM_BASE}/${documentId}/pdf`;
    const pdfBuffer = await fetchPdfBuffer(documentId, {"userId":userId});



    //const pdfBuffer = await fetchPdfBuffer(userId, aemAuth);
    const base64 = pdfBuffer.toString('base64');
    return res.json({ pdfBase64: base64 });
  } catch (error) {
    if (error.status) {
      console.error('AEM error', error.status, error.bodyPreview);
      return res.status(502).json({ error: 'communications service error', status: error.status, bodyPreview: error.bodyPreview });
    }
    console.error('wrapper error', error.message || error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.post('/email-pdf', async (req, res) => {
  try {
    // Validate SendGrid config
    if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
      return res.status(500).json({
        error: 'SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM env vars.'
      });
    }

    const { pdfBase64, to, subject, text, filename } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'missing recipient email (to)' });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'missing pdfBase64' });
    }

    // Remove optional data URL prefix if present
    const cleanedBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

    // Send via SendGrid
    const msg = {
      to: to,
      from: SENDGRID_FROM,
      subject: subject || 'Your PDF document',
      text: text || 'Please find attached.',
      attachments: [
        {
          content: cleanedBase64,
          type: 'application/pdf',
          filename: filename || 'document.pdf',
          disposition: 'attachment'
        }
      ]
    };

    const result = await sgMail.send(msg);

    return res.json({
      status: 'sent',
      sendgridResponse: Array.isArray(result)
        ? result[0].statusCode
        : (result && result.statusCode)
    });

  } catch (error) {
    console.error(
      'email-pdf error',
      error.response
        ? (error.response.body || error.response)
        : error.message || error
    );

    const errBody =
      error.response &&
      (error.response.body || error.response.data)
        ? error.response.body || error.response.data
        : undefined;

    return res.status(500).json({
      error: 'Failed to send email',
      details: errBody || error.message
    });
  }
});


/**
 * POST /generate-and-send
 * Body (JSON):
 * {
 *   "userId": "12345",                // required: forwarded to FDM
 *   "to": "recipient@example.com",    // required
 *   "subject": "Your PDF",            // optional
 *   "text": "Please find attached.",  // optional plain text
 *   "filename": "document.pdf"        // optional filename for attachment
 * }
 *
 * Headers:
 * - If AEM_BEARER not set in env, include Authorization: Bearer <AEM_TOKEN>
 * - If INTERNAL_API_KEY is set, include x-api-key: <INTERNAL_API_KEY>
 *
 * Requires SENDGRID_API_KEY and SENDGRID_FROM to be set in env.
 */
app.post('/generate-and-send', async (req, res) => {
  try {
    // internal auth
    
    // Validate SendGrid config
    if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
      return res.status(500).json({ error: 'SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM env vars.' });
    }

    const { userId, to, subject, text, filename } = req.body;
    if (!userId) return res.status(400).json({ error: 'missing userId' });
    if (!to) return res.status(400).json({ error: 'missing recipient email (to)' });

    const aemAuth = AEM_BEARER || req.header('Authorization');
    if (!aemAuth) return res.status(401).json({ error: 'missing AEM Authorization' });

    // 1) generate PDF from AEM (buffer)
    const pdfBuffer = await fetchPdfBuffer(userId, aemAuth);

    // 2) base64 encode
    const pdfBase64 = pdfBuffer.toString('base64');

    // 3) send via SendGrid
    const msg = {
      to: to,
      from: SENDGRID_FROM,
      subject: subject || 'Your generated PDF',
      text: text || 'Please find attached.',
      attachments: [
        {
          content: pdfBase64,
          type: 'application/pdf',
          filename: filename || 'document.pdf',
          disposition: 'attachment'
        }
      ]
    };

    // Optional: include dynamic_template_id or html content if desired
    const result = await sgMail.send(msg); // returns array for multiple recipients sometimes
    // SendGrid returns 202 Accepted; not always returns body, but success if no error thrown
    return res.json({ status: 'sent', sendgridResponse: Array.isArray(result) ? result[0].statusCode : (result && result.statusCode) });
  } catch (error) {
    // handle AEM upstream error
    if (error.status) {
      console.error('AEM error', error.status, error.bodyPreview);
      return res.status(502).json({ error: 'communications service error', status: error.status, bodyPreview: error.bodyPreview });
    }
    // handle sendgrid / other errors
    console.error('generate-and-send error', error.response ? (error.response.body || error.response) : error.message || error);
    const errBody = error.response && (error.response.body || error.response.data) ? error.response.body || error.response.data : undefined;
    return res.status(500).json({ error: 'Failed to generate and send', details: errBody || error.message });
  }
});

