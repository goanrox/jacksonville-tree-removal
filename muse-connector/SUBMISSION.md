# Muse Connector Submission — Onslow Tree Removal

Copy-paste package for the form at **muse.ai/platform**.
Review flow per Meta: describe the product → functional/security/legal review + end-to-end testing → directory listing.

---

## 1. What the connector does (product description)

**Onslow Tree Removal** is a tree-service lead-intake connector for homeowners in
Jacksonville and Onslow County, North Carolina. It gives Muse three abilities:

1. **List services** — tree removal, trimming & pruning, stump grinding, lot
   clearing, and emergency storm cleanup, with contact info. (read-only)
2. **Check the service area** — confirms whether the homeowner's town is covered.
   (read-only)
3. **Submit a quote request** — sends a structured sales lead (name, phone, email,
   address, service, urgency, details, optional tree photo) to the business inbox
   so the crew can call back. (write; the ONLY side effect is one lead email)

**User story:** A homeowner in Jacksonville, NC tells Muse: "a pine fell on my
fence last night, I need someone to look at it." Muse checks the service area,
confirms emergency storm cleanup is offered, collects the homeowner's contact
details and address, and submits a quote request. The business calls back.

This is a **merchant-style connector** (like a shopping connector): the caller
is the homeowner via Muse, so there is no per-user account or OAuth. The
connector authenticates with a single scoped bearer token that Meta stores with
the connector configuration and sends as `Authorization: Bearer <token>`.

## 2. Technical details for the review form

- **Base URL:** `https://onslowtreeremoval.com`
- **Machine-readable spec:** `https://onslowtreeremoval.com/muse-connector/openapi.json`
- **Connector descriptor:** `https://onslowtreeremoval.com/muse-connector/manifest.json`
- **Auth:** bearer token on the write endpoint (`POST /api/connector/v1/quote-requests`).
  Read endpoints are public (they carry no PII). The API fails closed with 503
  until the token is configured server-side.
- **Review testing:** submit any quote request with `"dry_run": true` and any
  `idempotency_key` — this runs full validation, email MX verification, and photo
  hosting, then returns success WITHOUT sending a lead email. Safe to run
  repeatedly.
- **Review bearer token:** provided separately in the submission form
  (rotate after approval if desired — it is a single env var on our side).

## 3. Functional notes (what reviewers should know)

- `idempotency_key` is **required** on the write endpoint: retries with the same
  key return the original response for 24h instead of creating a duplicate lead.
  (Best-effort per serverless instance; the key is also stamped on the lead
  email so any duplicate is visible to the business.)
- All fields are typed and length-capped; error responses are human-readable and
  safe for the agent to relay to the user verbatim.
- Photos are optional; a failed photo upload never loses the lead — the request
  still goes through flagged for phone verification.
- Rate limit: 20 quote requests/hour per token. Body cap 8 MB; photos under 5 MB.
- If the lead inbox is ever unreachable, the API returns 502 with a message
  telling the user to call (910) 601-5667.

## 4. Security

- TLS everywhere (Vercel). Timing-safe bearer-token comparison.
- Input validation on every field; email domains MX-verified (fake addresses
  rejected); phone numbers must be valid 10-digit US numbers.
- No destructive actions exist in this connector: no payments, no bookings, no
  account changes. The only side effect is a lead email.
- Spam/abuse: token auth + rate limiting + idempotency keys + MX verification.
- No database: PII (name, phone, email, address, photo) exists only in the lead
  email sent to the business inbox.

## 5. Legal / privacy

- Privacy policy: https://onslowtreeremoval.com/privacy.html
- Terms: https://onslowtreeremoval.com/terms.html
- Data collected: name, phone, email, street address, service details, optional
  tree photo — only what is needed to call the homeowner back about their quote.
- Photos: uploaded to a temporary image host and auto-deleted after 72 hours;
  disclosed in the privacy policy and next to the photo field.
- Data retention: no database; lead details live only in the business's email
  inbox.

## 6. Business verification (for the legal review)

- Business: Onslow Tree Removal (New River Digital), Jacksonville, NC
- Website: https://onslowtreeremoval.com (live, SSL valid)
- Phone: (910) 601-5667 — business line, voicemail with callback
- Email: newriverdigitalnc@gmail.com
- Facebook Page: "Onslow Tree Removal" (username onslowtreeremoval)

## 7. Suggested directory copy

- **Name:** Onslow Tree Removal
- **One-liner:** Get a tree-service quote in Jacksonville & Onslow County, NC —
  removal, trimming, stump grinding, and storm cleanup.
- **How users use it:** "Ask Muse to get me a quote from Onslow Tree Removal" —
  Muse checks your town, takes your details, and the crew calls you back.
