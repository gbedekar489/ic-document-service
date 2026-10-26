
const express = require('express');
const router = express.Router();

// Sample state-wise sales data
const stateSales = [
  { state: 'CA', count: 150 },
  { state: 'TX', count: 95 },
  { state: 'NY', count: 70 },
  { state: 'FL', count: 55 },
  { state: 'WA', count: 40 },
  { state: 'GA', count: 25 },
  { state: 'IL', count: 20 },
  { state: 'AZ', count: 15 },
  { state: 'CO', count: 10 },
  { state: 'ME', count: 5 }
];

router.get('/states/sales', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');

  res.json({
    total: stateSales.reduce(
      (sum, item) => sum + item.count, 0
    ),
    states: stateSales
  });
});

module.exports = router;
