# Hosting and acceptance update — 2026-11-05

Latest full feature/API audit: [FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md). Added current NDMA SACHET CAP warnings and TomTom road incidents; fixed IST-day rollover, reused Blob object paths that produced hosted 404s, and the OSRM fallback URL. Current source research and access gaps are in [SOURCE_RESEARCH.md](SOURCE_RESEARCH.md).

Public site: https://nammadrishti.vercel.app/
Account registration and sign-in: https://nammadrishti.vercel.app/?account=1

The deployment uses Vercel Hobby for the Vite frontend and Node 24 API, Firebase Authentication/Firestore for accounts and durable records, and Vercel Blob for validated photo objects. No paid plan was activated. Free-plan quotas still apply. Render creation was attempted on the explicitly confirmed workspace and rejected with `402 billing_suspended`; no Render service was created or billing changed.

## Realtime and privacy

Hosted clients subscribe to the latest 1,000 public incidents through the Firebase SDK. The API writes the private incident and a sanitized public projection in the same fenced transaction. Hide/delete removes the public document atomically. Browser rules allow authenticated reads of this projection only, cap list queries, deny all browser writes, and deny direct reads of private collections. Contributor UID/voter arrays, moderation records and emergency coordinates are excluded from public projections. Public REST/socket responses use the same projection. Standalone Node development retains Socket.IO.

The Vercel WebSocket route did not pass hosted upgrade tests, despite current platform documentation describing support. The deployed product therefore uses the verified Firestore listener, rather than claiming the failing route works.

Backend compatibility: `jwks-rsa`'s `jose` dependency is pinned to CommonJS-compatible 5.10.0 for the Firebase Admin 14 serverless import issue (upstream https://github.com/firebase/firebase-admin-node/issues/3181). Token verification and moderator enforcement were retested against live Firebase. Both dependency audits remain clean.

## Verified

- Hosted readiness, weather, traffic and regional river model endpoints.
- TomTom returned actual speeds/confidence for all four sampled corridors. Its key was moved out of the tracked example into ignored runtime configuration and encrypted hosting settings.
- Live hosted verified-email reporting, contributor binding, non-moderator denial, moderator hide/restore and hidden-ID replay rejection. Temporary fixtures/accounts removed.
- T3 browser: Connected via Firestore; a temporary report posted through the hosted API appeared without reloading the page, then disappeared after cleanup.
- Account UI repaired after the supplied screenshot: opaque card, stacked labeled inputs, distinct create/sign-in modes, visible verification feedback, mobile bounds and scroll behavior. Desktop and 390 px layout checked in T3.
- Notification API and service worker are configured. The T3 browser reports `Notification.permission === 'denied'`; clicking the button correctly shows permission denial. Actual OS/background delivery is **not** verified while permission is denied.
- Five dispatch scenario tests use a local HTTP receiver: explicit matching ACK/idempotency, outage/restart recovery, wrong ACK/five-attempt failure/expiry, stale-replica replay prevention, and no-recipient behavior. These do not contact emergency agencies.
- MyMemory's free public API supplied 20 Kannada and 20 Hindi static UI translations. Cached labels ship with the app and need no runtime translation request. Provider results were checked for nonempty target-script text; linguistic review remains necessary. No user reports, credentials or emergency text were sent for translation.

## Flood data findings

Current and legacy IMD station/rainfall endpoints returned HTTP 401; the new API explicitly returned `API key missing`. They are documented publicly but not accessible anonymously here.

Open-Meteo's keyless flood API returned live daily GloFAS river-discharge model values around Bengaluru. The app displays this separately, with returned grid coordinates, retrieval time, m³/s units and a 5 km/daily-model explanation. It is not an urban flood-depth sensor, underpass measurement, road-clearance signal or guarantee of safety. The authorized measured-depth adapter remains unconfigured.

## Operation

Vercel executes background work with `waitUntil`, an authenticated daily maintenance cron and opportunistic maintenance on requests. Retries can be delayed while the app is idle; this is not a continuously staffed emergency dispatch system. Call 112 for urgent assistance. Durable outboxes survive cold starts; the JSON local fallback is not used by hosted production.

Required hosted settings are Firebase public web configuration, private `FIREBASE_SERVICE_ACCOUNT_JSON`, `TOMTOM_API_KEY`, VAPID keys/subject, `CRON_SECRET`, `REACT_APP_REALTIME_TRANSPORT=firestore`, and the connected Blob store. Secrets are never frontend build variables. Firebase authorizes the two stable owned Vercel domains. Backups must include Blob objects separately from JSON records; hosted off-site scheduling and a complete recovery drill remain open.

Moderator access: after the requested account completed email verification, the moderator claim was granted and read back successfully. No verification bypass was applied. The account panel provides verification resend and role refresh.

Final local validation: 15 frontend tests, 35 backend tests, the user journey, 8 sandbox scenarios and 24 stress checks pass. Root and backend audits report zero vulnerabilities.

## Traffic display repair — 2026-11-05

The map previously drew only four TomTom point samples plus four static corridor lines. It now overlays live TomTom relative-flow tiles across Bengaluru through a bounded server-side proxy. Static corridor lines were removed. The default Traffic sidebar presents the four samples with speeds, confidence, retrieval time and locate actions, clearly separated from community report counts. Eleven approximate underpass locations are visible as an independent layer, with unknown-condition wording. An empty report-density layer explains why nothing is drawn. Overview shows regional-river loading/failure states and refreshes automatically.

Hosted acceptance: the existing key returned a valid 256px PNG with nontransparent road pixels; all 16 traffic tiles in the desktop viewport loaded successfully. The Traffic panel showed four real speed readings. Overview loaded current rainfall for the catalog and the regional river forecast. The 390px layout had no horizontal document overflow. These checks do not establish street-level flood sensors or complete traffic coverage on every road. Local frontend and backend regression suites cover layer toggles, stale sample suppression, tile bounds, caching, provider failure and response validation.
