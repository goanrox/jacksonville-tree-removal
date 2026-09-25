'use strict';
// GET /api/connector/v1/service-area
// Public, read-only: where Onslow Tree Removal works.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method !== 'GET') {
    res.status(405).end(JSON.stringify({ success: false }));
    return;
  }
  res.status(200).end(JSON.stringify({
    success: true,
    business: 'Onslow Tree Removal',
    county: 'Onslow County, North Carolina',
    towns: [
      'Jacksonville',
      'Sneads Ferry',
      'Holly Ridge',
      'Swansboro',
      'Richlands',
      'Hubert'
    ],
    note: 'Homeowners just outside these towns can still request a quote — mention the address and we will confirm coverage on the callback.',
    contact: {
      phone: '(910) 601-5667',
      website: 'https://onslowtreeremoval.com'
    }
  }));
};
