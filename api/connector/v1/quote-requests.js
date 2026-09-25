'use strict';
// POST /api/connector/v1/quote-requests
// Muse connector intake: lets the Muse agent submit a tree-service quote
// request on a homeowner's behalf. This is a merchant-style connector (like a
// shopping connector) — the caller is the homeowner via Muse, so there is no
// per-user OAuth. The connector itself authenticates with a shared bearer
// token (CONNECTOR_TOKEN env var) that Meta stores with the connector config.
//
// Agent-first design:
//   - idempotency_key is REQUIRED: agents retry; retries never double-submit.
//   - Typed, length-capped fields; human-readable error messages.
//   - dry_run: true runs full validation + photo hosting without emailing.
//   - Fails closed: 503 when CONNECTOR_TOKEN is not configured.
//
// Security: bearer token (timing-safe compare), per-token sliding-window rate
// limit, 8 MB body cap, email MX verification, no database (PII lives only in
// the lead email), photos auto-delete from the image host after 72h.

const crypto = require('crypto');
const pipeline = require('../../_lib/lead-pipeline');

// Best-effort in-memory stores (documented honestly in the connector manifest:
// serverless instances scale, so these are per-instance windows).
const rateWindows = new Map();   // tokenHash -> { count, windowStart }
const idempotency = new Map();   // key -> { status, body, ts }

const RATE_PER_HOUR = 20;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function tokenHash(t) {
  return crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
}

function checkRateLimit(token) {
  const h = tokenHash(token);
  const now = Date.now();
  let w = rateWindows.get(h);
  if (!w || now - w.windowStart > 60 * 60 * 1000) {
    w = { count: 0, windowStart: now };
    rateWindows.set(h, w);
  }
  w.count += 1;
  return w.count <= RATE_PER_HOUR;
}

function getCached(key) {
  const e = idempotency.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > IDEMPOTENCY_TTL_MS) { idempotency.delete(key); return null; }
  return e;
}

function putCached(key, status, body) {
  if (idempotency.size > 5000) {
    const oldest = idempotency.keys().next().value;
    idempotency.delete(oldest);
  }
  idempotency.set(key, { status, body, ts: Date.now() });
}

function send(res, status, body) {
  res.status(status).end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    send(res, 405, { success: false, error: { code: 'method_not_allowed', message: 'Use POST.' } });
    return;
  }

  const expected = process.env.CONNECTOR_TOKEN;
  if (!expected) {
    send(res, 503, { success: false, error: { code: 'not_configured', message: 'The connector is not configured yet. Please call (910) 601-5667.' } });
    return;
  }

  const auth = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(auth);
  const provided = m ? m[1] : '';
  const okAuth = provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!okAuth) {
    send(res, 401, { success: false, error: { code: 'unauthorized', message: 'A valid connector token is required.' } });
    return;
  }

  if (!checkRateLimit(provided)) {
    send(res, 429, { success: false, error: { code: 'rate_limited', message: 'Too many quote requests. Please wait a while and try again, or call (910) 601-5667.' } });
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
    send(res, 413, { success: false, error: { code: 'too_large', message: 'The request is too large (8 MB max).' } });
    return;
  }

  let d;
  try { d = JSON.parse(raw); }
  catch (e) {
    send(res, 400, { success: false, error: { code: 'bad_json', message: 'The request body must be valid JSON.' } });
    return;
  }

  // Idempotency: identical key returns the original response, never a new lead.
  if (d && typeof d.idempotency_key === 'string' && d.idempotency_key) {
    const cached = getCached(d.idempotency_key);
    if (cached) { send(res, cached.status, cached.body); return; }
  }

  const result = await pipeline.processLead(d, {});

  let status, body;
  if (!result.ok) {
    const badInput = result.errors && result.errors.some((e) => e.code === 'invalid' || e.code === 'bad_json');
    status = badInput ? 400 : 502;
    body = { success: false, errors: result.errors };
  } else {
    status = 200;
    body = {
      success: true,
      lead_id: result.lead_id,
      dry_run: result.dry_run === true,
      photo_status: result.photo_url ? 'received' : (result.photo_error ? 'failed — homeowner should text the photo to (910) 601-5667' : 'not provided'),
      confirmation: result.dry_run === true
        ? 'Dry run OK. The quote request is valid and would have been sent.'
        : 'Quote request received. Onslow Tree Removal will call back at the number provided — calls go to voicemail during work hours, so leaving details helps us respond faster. For anything urgent, call (910) 601-5667.'
    };
  }

  if (d && typeof d.idempotency_key === 'string' && d.idempotency_key && result.ok) {
    putCached(d.idempotency_key, status, body);
  }
  send(res, status, body);
};
