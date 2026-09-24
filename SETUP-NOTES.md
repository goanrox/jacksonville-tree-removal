# Revenue-Loop Setup Notes

**For the owner only — not linked from the website.** This is the checklist for the
lead-revenue upgrades added Sep 2026. Everything here costs $0 and uses no new
accounts.

---

## 1. Instant lead alerts on your phone (one step you must do)

Leads now push a notification to your phone the moment one lands. You need the
free **ntfy** app:

1. Install **ntfy** (free) from the App Store or Google Play.
2. Open ntfy → tap **+** (Subscribe) → enter this topic name exactly:
   `jtr-leads-b88e37a35113675ee365668e80061a87`
3. Tap Subscribe, then allow notifications when your phone asks.

That's it — no account, no login, no cost. From then on, every website lead
pushes a phone notification with the homeowner's name, phone, service needed,
location, and urgency. The lead email still arrives as before; this is on top
of it.

To test: tap **…** on the subscribed topic in ntfy → "Send a notification"
(only tests the app side, sends nothing to the site).

## 2. Homeowner auto-reply (already working — nothing to do)

Every lead now triggers an instant confirmation email to the homeowner:
thanks, we'll call back same-day from (910) 601-5667, plus the jingle line.
It works on both submission paths (JavaScript and no-JavaScript) via
Web3Forms' built-in auto-reply — free, no new signup.

To confirm it yourself: submit a test request with an email address you can
check (the test request will also arrive in the business inbox and fire a
push notification — that's normal).

## 3. Lead attribution (already working — nothing to do)

Every lead email now carries: the exact page it came from, the referrer, and
any UTM tracking tags (utm_source / medium / campaign / term / content).
When you sign tree companies as paying providers, this is what proves a lead
is real and came through your site.

## 4. Call tracking (NOT done — needs your approval and ~$1/month)

A true call-tracking number (a number that forwards to your line and logs
calls so you can prove calls to providers) requires paid telephony. The
cheapest path is Twilio: roughly $1/month for a local number plus a few cents
per minute of forwarded calls. Nothing has been bought. Say the word and it's
a 30-minute setup.

## 5. Known limitation: no-JavaScript submissions

If a homeowner has JavaScript turned off, their form posts straight to
Web3Forms, skipping the endpoint's extra checks (email-domain verification,
photo hosting). The spam honeypot and the auto-reply still work for those.
This is an edge case; the checks still run for the ~99% with JavaScript on.

---

## How to verify a lead now

Submit a real test request on the site. You should see all three within a minute:

1. ✅ A push notification on your phone (ntfy)
2. ✅ A lead email in the business inbox with name/phone/service/attribution
3. ✅ A confirmation email in the homeowner's inbox ("Thanks for reaching out…")
