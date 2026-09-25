'use strict';
// GET /api/connector/v1/services
// Public, read-only: what Onslow Tree Removal does and how to reach us.
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
    tagline: 'Six-oh-one, five-six, six-seven — Onslow Tree Removal gets it done!',
    contact: {
      phone: '(910) 601-5667',
      email: 'newriverdigitalnc@gmail.com',
      website: 'https://onslowtreeremoval.com'
    },
    callback_note: 'Calls go to voicemail during work hours — leave your name and details and we will call back.',
    services: [
      {
        service_id: 'tree-removal',
        name: 'Tree Removal',
        description: 'Safe removal of dead, diseased, leaning, or unwanted trees, including trees threatening homes, fences, and power lines.'
      },
      {
        service_id: 'tree-trimming',
        name: 'Tree Trimming & Pruning',
        description: 'Crown cleaning, shaping, and clearance trimming to keep trees healthy and away from roofs and lines.'
      },
      {
        service_id: 'stump-grinding',
        name: 'Stump Grinding & Removal',
        description: 'Grinding leftover stumps below grade so the yard is usable again.'
      },
      {
        service_id: 'lot-clearing',
        name: 'Lot Clearing',
        description: 'Clearing overgrown lots and small parcels for building, fencing, or cleanup.'
      },
      {
        service_id: 'emergency-storm',
        name: 'Emergency Storm Cleanup',
        description: 'Fast response for fallen trees and storm damage blocking driveways, homes, or roads.'
      }
    ]
  }));
};
