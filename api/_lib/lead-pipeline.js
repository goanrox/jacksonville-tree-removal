'use strict';
// Shared hardened lead pipeline for Onslow Tree Removal.
// Used by the Muse connector intake (/api/connector/v1/quote-requests).
// The public website form (/api/submit-lead) keeps its own copy so a live,
// working form is never touched by connector work.
//
// Steps:
//   1. Validates the lead fields (typed, length-capped).
//   2. Verifies the email domain can actually receive mail (MX lookup).
//   3. Hosts the tree photo on a free image host (Web3Forms free tier has no attachments).
//   4. Forwards the full lead to Web3Forms, which delivers to the business inbox.
// Pass { dry_run: true } to run verification + photo hosting without forwarding.

const https = require('https');
const dns = require('dns').promises;

const WEB3FORMS_KEY = process.env.WEB3FORMS_ACCESS_KEY || 'f1fceae7-76d1-4164-a0bf-12befbfd7eb0';

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout:' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function postMultipart(url, textFields, fileFieldName, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----otr' + Math.random().toString(36).slice(2) + Date.now().toString(36);
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
        'User-Agent': 'onslowtreeremoval-lead-pipeline/1.0'
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
      { 'Accept': 'application/json', 'User-Agent': 'onslowtreeremoval-lead-pipeline/1.0' },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1);
  return null;
}

// Validates a normalized lead object. Returns { ok, errors } where errors is a
// list of { field, code, message } with human-readable messages (agents may
// surface these to users verbatim).
function validateLead(d) {
  const errors = [];
  const need = (cond, field, message) => { if (!cond) errors.push({ field, code: 'invalid', message }); };

  need(d && typeof d === 'object', 'body', 'The request body must be a JSON object.');
  if (!d || typeof d !== 'object') return { ok: false, errors };

  need(typeof d.idempotency_key === 'string' && d.idempotency_key.length >= 1 && d.idempotency_key.length <= 128,
    'idempotency_key', 'Provide a unique idempotency_key (up to 128 characters) so retries never create duplicate leads.');

  const c = d.contact || {};
  need(typeof c.name === 'string' && c.name.trim().length >= 1 && c.name.trim().length <= 120,
    'contact.name', 'Provide the homeowner\u2019s name (1\u2013120 characters).');
  need(normalizePhone(c.phone) !== null,
    'contact.phone', 'Provide a valid 10-digit US phone number so we can call back.');
  const email = String(c.email || '').trim();
  need(EMAIL_RE.test(email) && email.length <= 200,
    'contact.email', 'Provide a valid email address.');

  const services = ['tree-removal', 'tree-trimming', 'stump-grinding', 'lot-clearing', 'emergency-storm'];
  need(services.includes(d.service_id),
    'service_id', 'service_id must be one of: ' + services.join(', ') + '.');

  need(typeof d.address === 'string' && d.address.trim().length >= 5 && d.address.trim().length <= 300,
    'address', 'Provide the street address where the tree work is needed.');
  if (d.zip !== undefined && d.zip !== null && String(d.zip).trim() !== '') {
    need(/^\d{5}$/.test(String(d.zip).trim()), 'zip', 'zip must be a 5-digit US ZIP code.');
  }

  const urgencies = ['emergency', 'soon', 'planning'];
  need(urgencies.includes(d.urgency),
    'urgency', 'urgency must be one of: emergency (hazard / storm damage), soon (within 2 weeks), planning (getting quotes).');

  if (d.details !== undefined && d.details !== null && String(d.details) !== '') {
    need(String(d.details).length <= 2000, 'details', 'details must be 2000 characters or fewer.');
  }
  if (d.photo_base64 !== undefined && d.photo_base64 !== null && String(d.photo_base64) !== '') {
    let size = 0;
    try { size = Buffer.from(String(d.photo_base64), 'base64').length; } catch (e) { size = -1; }
    need(size > 0 && size <= 5 * 1024 * 1024, 'photo_base64', 'photo_base64 must be a valid image under 5 MB.');
  }

  return { ok: errors.length === 0, errors };
}

// Runs the full pipeline: validation -> email MX check -> photo hosting ->
// Web3Forms forward (unless dry_run). Returns { ok, lead_id, photo_url,
// photo_error, errors }.
async function processLead(d, opts) {
  opts = opts || {};
  const v = validateLead(d);
  if (!v.ok) return { ok: false, errors: v.errors };

  const email = String(d.contact.email).trim();
  const domain = email.split('@').pop().toLowerCase();
  if (!(await domainCanReceiveMail(domain))) {
    return { ok: false, errors: [{ field: 'contact.email', code: 'invalid', message: 'That email domain cannot receive mail. Double-check the address.' }] };
  }

  // Photo is optional for the connector, but a failed upload must NEVER lose
  // the lead. On failure we flag it loudly so it gets phone-verified instead.
  let photoUrl = '', photoError = '';
  if (d.photo_base64) {
    try {
      const buf = Buffer.from(String(d.photo_base64), 'base64');
      photoUrl = (await hostPhoto(buf)).url;
    } catch (e) {
      photoError = 'PHOTO UPLOAD FAILED (' +
        ((e && e.attempts && e.attempts.join(' | ')) || (e && e.message) || 'unknown') +
        ') \u2014 ask the homeowner to text the tree photo to (910) 601-5667';
    }
  }

  const leadId = 'muse-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  if (d.dry_run === true) {
    return { ok: true, dry_run: true, lead_id: leadId, photo_url: photoUrl, photo_error: photoError || undefined };
  }

  const payload = {
    access_key: WEB3FORMS_KEY,
    subject: (opts.subject || 'New Lead (Muse connector) \u2014 Onslow Tree Removal') +
      (photoError ? ' \u2014 \u26a0\ufe0f PHOTO MISSING, VERIFY BY PHONE' : ''),
    from_name: 'Onslow Tree Removal (Muse connector)',
    name: String(d.contact.name).trim(),
    phone: normalizePhone(d.contact.phone),
    email,
    address: String(d.address).trim(),
    zip: d.zip ? String(d.zip).trim() : '',
    details: d.details ? String(d.details) : '',
    urgency: String(d.urgency),
    service: String(d.service_id),
    photo_url: photoUrl,
    photo_status: photoUrl ? 'uploaded: ' + photoUrl : (photoError || 'no photo provided'),
    lead_id: leadId,
    idempotency_key: String(d.idempotency_key),
    source: 'muse-connector',
    submitted_at: new Date().toISOString(),
    botcheck: ''
  };

  try {
    const w = await withTimeout(httpsJson('POST', 'https://api.web3forms.com/submit', payload), 15000, 'web3forms');
    if (!w || !w.json || w.json.success !== true) throw new Error('web3forms rejected the submission');
  } catch (e) {
    return { ok: false, errors: [{ field: 'submit', code: 'upstream', message: 'Our lead inbox is temporarily unreachable. Please call (910) 601-5667 instead.' }] };
  }

  return { ok: true, lead_id: leadId, photo_url: photoUrl, photo_error: photoError || undefined };
}

module.exports = { validateLead, processLead, normalizePhone, domainCanReceiveMail };
