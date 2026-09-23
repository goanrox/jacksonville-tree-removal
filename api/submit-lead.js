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

// Free, no-key image hosts. Catbox first, 0x0.st as fallback.
async function hostPhoto(buffer) {
  try {
    const up = await withTimeout(
      postMultipart('https://catbox.moe/user/api.php', { reqtype: 'fileupload' }, 'fileToUpload', buffer, 'tree-photo.jpg'),
      20000, 'catbox');
    if (up.status === 200 && /^https?:\/\//.test(up.body)) return up.body;
    throw new Error('catbox rejected: ' + up.body.slice(0, 120));
  } catch (e) {
    const up = await withTimeout(
      postMultipart('https://0x0.st', {}, 'file', buffer, 'tree-photo.jpg'),
      20000, '0x0st');
    if (up.status === 200 && /^https?:\/\//.test(up.body)) return up.body;
    throw new Error('image hosts unavailable');
  }
}

function postJson(url, obj) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(obj));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'onslowtreeremoval-lead-form/1.0'
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { resolve({ success: false, raw: raw.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout:web3forms')));
    req.write(data);
    req.end();
  });
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

  // The domain must have mail servers, or the address cannot receive anything.
  const domain = email.split('@').pop().toLowerCase();
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 5000, 'mx');
    if (!mx || !mx.length) throw new Error('no mx records');
  } catch (e) {
    res.status(400).end(JSON.stringify({ success: false, error: 'email' }));
    return;
  }

  let photoUrl = '';
  try {
    if (!d.photoBase64) throw new Error('photo required');
    const buf = Buffer.from(d.photoBase64, 'base64');
    if (!buf.length || buf.length > 5 * 1024 * 1024) throw new Error('bad photo size');
    photoUrl = await hostPhoto(buf);
  } catch (e) {
    res.status(502).end(JSON.stringify({ success: false, error: 'photo' }));
    return;
  }

  if (d.dry_run === true) {
    res.status(200).end(JSON.stringify({ success: true, dry_run: true, photo_url: photoUrl }));
    return;
  }

  const payload = {
    access_key: String(d.access_key),
    subject: d.subject || 'New Lead — Onslow Tree Removal',
    from_name: d.from_name || 'Onslow Tree Removal website',
    name: d.name || '',
    phone: String(d.phone),
    email,
    address: String(d.address),
    details: d.details || '',
    urgency: String(d.urgency),
    service: String(d.service),
    photo_url: photoUrl,
    lead_id: d.lead_id || '',
    source_url: d.source_url || '',
    referrer: d.referrer || '',
    submitted_at: d.submitted_at || new Date().toISOString(),
    botcheck: d.botcheck || ''
  };

  try {
    const w = await withTimeout(postJson('https://api.web3forms.com/submit', payload), 15000, 'web3forms');
    if (!w || w.success !== true) throw new Error('web3forms rejected the submission');
  } catch (e) {
    res.status(502).end(JSON.stringify({ success: false }));
    return;
  }

  res.status(200).end(JSON.stringify({ success: true }));
};
