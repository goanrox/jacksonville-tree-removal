'use strict';
// POST /api/submit-lead
// Hardens lead submissions before they reach the inbox:
//   1. Verifies the email domain can actually receive mail (MX lookup).
//   2. Hosts the tree photo on a free image host (Web3Forms free tier has no attachments).
//   3. Forwards the full lead to Web3Forms, which delivers to the business inbox.
// Body: JSON { access_key, service, address, details, urgency, name, phone, email,
//               photoBase64, photoName, lead_id, source_url, referrer, submitted_at, ... }
// Pass { dry_run: true } to run verification + photo hosting without forwarding to Web3Forms.
const https = require('https');
const dns = require('dns').promises;

// ---------------------------------------------------------------------------
// Revenue-loop upgrade (Sep 2026)
// 1. Homeowner auto-reply via Web3Forms' built-in "autoresponse" field (free):
//    the homeowner gets an instant confirmation email for every lead. Set here
//    for the JS path; the no-JS path carries the same text as a hidden input
//    in each form. Keep the two copies in sync.
// 2. Instant owner push via ntfy.sh (free HTTP push): after the lead is
//    accepted, a notification fires to a private ntfy topic. The owner
//    installs the free ntfy app and subscribes — see SETUP-NOTES.md. The
//    topic token is unguessable; it is not a secret, it just keeps the
//    channel quiet. pushLeadAlert NEVER throws — a failed push must never
//    cost a lead.
// 3. Lead attribution groundwork: every lead carries page/referrer/UTM
//    details through to the inbox email, so leads are provable to providers
//    later. A true call-tracking number needs paid telephony (Twilio ~$1/mo
//    + usage) — documented as a costed next step in SETUP-NOTES.md, not
//    bought here.
// ---------------------------------------------------------------------------
const AUTO_REPLY = [
  'Thanks for reaching out to Onslow Tree Removal — we got your request.',
  '',
  'A real person here in Jacksonville reads every request and will call you back, usually the same day, from (910) 601-5667.',
  '',
  "If you'd rather talk sooner, just call or text us at (910) 601-5667.",
  '',
  'Six-oh-one, five-six, six-seven — Onslow Tree Removal gets it done!',
  '',
  '— Your Onslow Tree Removal team'
].join('\n');

const NTFY_TOPIC = 'jtr-leads-b88e37a35113675ee365668e80061a87';

async function pushLeadAlert(d) {
  try {
    const lines = [
      'Name: ' + (d.name || '(not given)'),
      'Phone: ' + (d.phone || '(not given)'),
      'Service: ' + (d.service || '(not given)'),
      'Where: ' + (d.address || '(not given)'),
      'Urgency: ' + (d.urgency || '(not given)'),
      'Email: ' + (d.email || '(not given)'),
      'Lead ID: ' + (d.lead_id || '(none)'),
      'Page: ' + (d.source_url || d.page_url || '(unknown)')
    ];
    await withTimeout(httpsJson('POST', 'https://ntfy.sh', {
      topic: NTFY_TOPIC,
      title: 'New tree request',
      priority: 4,
      tags: ['tree'],
      message: lines.join('\n')
    }), 8000, 'ntfy');
  } catch (e) {
    // Swallowed on purpose: push is a nicety, the lead is the asset.
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout:' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function postMultipart(url, textFields, fileFieldName, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----jtr' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const parts = [];
    for (const [k, v] of Object.entries(textFields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
        'User-Agent': 'onslowtreeremoval-lead-form/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: (data || '').trim() }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout:upload')));
    req.write(body);
    req.end();
  });
}

// Free, no-key image hosts. Catbox first, Litterbox (catbox temp storage) as fallback.
// Never throws away the lead: returns { url } or throws with .attempts detail.
async function hostPhoto(buffer) {
  const attempts = [];
  const hosts = [
    { name: 'catbox',
      fn: () => postMultipart('https://catbox.moe/user/api.php',
        { reqtype: 'fileupload' }, 'fileToUpload', buffer, 'tree-photo.jpg') },
    { name: 'litterbox',
      fn: () => postMultipart('https://litterbox.catbox.moe/resources/internals/api.php',
        { reqtype: 'fileupload', time: '72h' }, 'fileToUpload', buffer, 'tree-photo.jpg') },
  ];
  for (const h of hosts) {
    try {
      const up = await withTimeout(h.fn(), 20000, h.name);
      if (up.status === 200 && /^https?:\/\//.test(up.body)) return { url: up.body, host: h.name };
      attempts.push(h.name + ': rejected(' + up.status + ') ' + up.body.slice(0, 80));
    } catch (e) {
      attempts.push(h.name + ': ' + String((e && e.message) || e).slice(0, 80));
    }
  }
  const err = new Error('image hosts unavailable');
  err.attempts = attempts;
  throw err;
}

function httpsJson(method, url, obj, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = obj ? Buffer.from(JSON.stringify(obj)) : null;
    const u = new URL(url);
    const headers = Object.assign(
      { 'Accept': 'application/json', 'User-Agent': 'onslowtreeremoval-lead-form/1.0' },
      extraHeaders || {});
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, json: null, raw: raw.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout:https')));
    if (data) req.write(data);
    req.end();
  });
}

// Returns true when the domain can receive mail: it must publish MX records.
// Native DNS first (fast); DNS-over-HTTPS fallbacks keep verification working
// even where the platform resolver refuses MX queries.
async function domainCanReceiveMail(domain) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000, 'mx');
    if (mx && mx.length) return true;
  } catch (e) {
    if (e && e.code === 'ENOTFOUND') return false; // the domain itself does not exist
    // Any other resolver failure (EREFUSED, ETIMEDOUT, ESERVFAIL...) is not an
    // answer about the domain — confirm over HTTPS instead.
  }
  const q = encodeURIComponent(domain);
  const doh = [
    `https://cloudflare-dns.com/dns-query?name=${q}&type=MX`,
    `https://dns.google/resolve?name=${q}&type=MX`
  ];
  for (const url of doh) {
    try {
      const r = await withTimeout(
        httpsJson('GET', url, null, { 'Accept': 'application/dns-json' }), 6000, 'doh');
      const j = r && r.json;
      if (j && Array.isArray(j.Answer) && j.Answer.length > 0) return true;
      if (j && j.Status === 3) return false; // NXDOMAIN from an authoritative answer
    } catch (e) { /* try the next provider */ }
  }
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.status(405).end(JSON.stringify({ success: false }));
    return;
  }

  let raw = '';
  try {
    await new Promise((resolve, reject) => {
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 8 * 1024 * 1024) reject(new Error('payload too large'));
      });
      req.on('end', resolve);
      req.on('error', reject);
    });
  } catch (e) {
    res.status(413).end(JSON.stringify({ success: false }));
    return;
  }

  let d;
  try { d = JSON.parse(raw); }
  catch (e) { res.status(400).end(JSON.stringify({ success: false })); return; }

  const required = ['access_key', 'service', 'address', 'phone', 'email', 'urgency'];
  for (const f of required) {
    if (!d[f] || !String(d[f]).trim()) {
      res.status(400).end(JSON.stringify({ success: false, error: 'missing' }));
      return;
    }
  }

  const email = String(d.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    res.status(400).end(JSON.stringify({ success: false, error: 'email' }));
    return;
  }

  // The domain must be able to receive mail, or the address is fake.
  const domain = email.split('@').pop().toLowerCase();
  if (!(await domainCanReceiveMail(domain))) {
    res.status(400).end(JSON.stringify({ success: false, error: 'email' }));
    return;
  }


  // Photo is required from the homeowner, but a failed upload must NEVER lose
  // the lead. On failure we flag it loudly so it gets phone-verified instead.
  let photoUrl = '', photoError = '';
  try {
    if (!d.photoBase64) throw new Error('photo required');
    const buf = Buffer.from(d.photoBase64, 'base64');
    if (!buf.length || buf.length > 5 * 1024 * 1024) throw new Error('bad photo size');
    photoUrl = (await hostPhoto(buf)).url;
  } catch (e) {
    photoError = 'PHOTO UPLOAD FAILED (' +
      ((e && e.attempts && e.attempts.join(' | ')) || (e && e.message) || 'unknown') +
      ') — ask the homeowner to text the tree photo to (910) 601-5667';
  }

  if (d.dry_run === true) {
    res.status(200).end(JSON.stringify({
      success: true, dry_run: true, photo_url: photoUrl,
      photo_error: photoError || undefined
    }));
    return;
  }

  const payload = {
    access_key: String(d.access_key),
    subject: (d.subject || 'New Lead — Onslow Tree Removal') +
      (photoError ? ' — ⚠️ PHOTO MISSING, VERIFY BY PHONE' : ''),
    from_name: d.from_name || 'Onslow Tree Removal website',
    autoresponse: AUTO_REPLY, // instant homeowner confirmation (Web3Forms sends it free)
    name: d.name || '',
    phone: String(d.phone),
    email,
    address: String(d.address),
    details: d.details || '',
    urgency: String(d.urgency),
    service: String(d.service),
    photo_url: photoUrl,
    photo_status: photoUrl ? 'uploaded: ' + photoUrl : photoError,
    lead_id: d.lead_id || '',
    // Attribution groundwork: proves where each lead came from (for providers).
    source_url: d.source_url || '',
    page_title: d.page_title || '',
    referrer: d.referrer || '',
    utm_source: d.utm_source || '',
    utm_medium: d.utm_medium || '',
    utm_campaign: d.utm_campaign || '',
    utm_term: d.utm_term || '',
    utm_content: d.utm_content || '',
    submitted_at: d.submitted_at || new Date().toISOString(),
    botcheck: d.botcheck || ''
  };

  try {
    const w = await withTimeout(httpsJson('POST', 'https://api.web3forms.com/submit', payload), 15000, 'web3forms');
    if (!w || !w.json || w.json.success !== true) throw new Error('web3forms rejected the submission');
  } catch (e) {
    res.status(502).end(JSON.stringify({ success: false }));
    return;
  }

  // Fire-and-forget owner push; never blocks or fails the lead.
  pushLeadAlert(Object.assign({}, d, { email })).catch(function () {});

  res.status(200).end(JSON.stringify({ success: true }));
};
