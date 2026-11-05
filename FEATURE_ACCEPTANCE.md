# Feature acceptance — 5 November 2026

This record separates local assertions, live hosted API tests, browser checks and external acceptance gaps. No test establishes complete official coverage or road safety. Data counts change as providers update; they are observations from the test run, not fixed product totals.

## Everyday UI update

Navigation now starts with Today, Reports and Help. Today offers a compact summary with links to detailed traffic, warnings and rainfall. Report filters live with Reports; map layers and notification settings are collapsed until requested. Map selection offers an explicit Report here action rather than interrupting browsing with a form. New navigation/guidance supports English, Kannada and Hindi. Desktop and small-screen CSS retain large controls, readable text and keyboard focus.

The follow-up passed 35 frontend tests, 49 backend tests and the production build. Regression tests cover navigation, reporting and route dialogs, non-interrupting map selection, layer toggles, translation key parity, missing weather remaining unknown, provider geometry crossing a route, incomplete feed coverage and notification subscription rollback. Fresh T3 browser inspection at 390px confirmed readable Kannada layout, no horizontal document overflow and an active service worker. This is an emulated viewport, not a physical-phone test.

## Current source acceptance

`ACCEPTANCE_API_URL=https://nammadrishti.vercel.app/api npm run test:live-sources` passed against the hosted site. A run at 15:39 UTC reported Bengaluru date 2026-11-05, weather observed at 15:30 UTC, all four junction samples, one valid government warning, 554 provider incidents, three current/future river dates, five geocoding results, a valid traffic PNG, configured push and unauthorized moderation denial. Later browser counts changed normally with provider updates.

## Feature matrix

| Feature | Evidence in this audit | Limits |
|---|---|---|
| Firebase sign-in and verification gate | Live temporary account: unverified report rejected 403; verified account accepted; no-token write rejected 401 | Automated fixture verification does not prove inbox delivery. The user's own verification was checked separately |
| Report storage and identity | Hosted report persisted in Firestore with the authenticated contributor UID; fixture removed | Citizen consensus is not official verification |
| Realtime storage | Live fenced-writer/cross-replica test passed; browser reported Connected; sanitized projection remains the hosted transport | Standalone Socket.IO is separate from hosted Firestore |
| Moderator controls | Live non-moderator 403, moderator hide/restore, hidden-ID replay rejection, operations readiness | Temporary fixture role/account removed; real moderator account unchanged |
| Photos | Hosted PNG upload → WebP Blob object → successful GET, then deletion of that fixture object | Fixed a reproduced 404 with reused object paths. New uploads own unique immutable Blob URLs; old missing objects cannot be reconstructed |
| Traffic flow | Hosted actual speeds and PNGs; desktop/mobile traffic rendering checked | No displayed traffic on an uncoloured road is not proof of free flow |
| Road incidents | Authorized TomTom present feed, source/start/end/retrieval timestamps, browser search and pagination | Provider coverage is incomplete; 2,000-record and upstream response bounds are disclosed |
| Government warnings | Live NDMA CAP warning for Bengaluru; English/Kannada source variants; expiry, future-date, namespace, cancellation and error tests | CAP warning area is not a flood sensor footprint. Hindi falls back to the provider's available language |
| Weather and river model | Current model age validated; river forecast must contain today's IST date; midnight regression tests | Neither is measured road/underpass water depth |
| Radar | Past-frame catalog probe and prior hosted tile load; age/error labels retained | Bengaluru observation coverage is not guaranteed; transparent imagery is not proof of no rain |
| Underpass watch | Eleven independent catalog locations; model rainfall and unknown-condition labels | Locations need field verification; no calibrated sensor, pumps/barriers or road-clearance feed |
| Place search | Hosted Nominatim returned five Bengaluru results; browser origin/destination lookup succeeded | Explicit searches only; shared server geocoder gate and cache retained |
| Route planning | Browser Majestic → MG Road: 6.1 km, 8 min static ETA, route shown on map; reactive-route tests retained | Checks now include citizen reports and current provider Point/LineString geometry. Expired/stale provider records are excluded and unavailable/partial/truncated feeds keep the route incomplete. Proximity is not lane matching; no guaranteed avoidance or live traffic ETA |
| Routing outage fallback | Invalid backup hostname replaced with documented FOSSGIS endpoint; direct real route returned `Ok`; coalescing/cache regression added | Public demo services are for light use; per-browser spacing is not an unlimited service guarantee |
| Assistant | Live weather response in English/Kannada/Hindi; latest non-weather call returned `gemini-grounded` and `available` | Earlier calls fell back; the UI now labels AI-unavailable and cached-summary modes. Model answers remain advisory |
| Emergency location | Hosted location-only save, owner status read and unauthenticated 404; private fixture removed; five local dispatch ACK/retry/expiry scenarios pass | No emergency agency was contacted. A webhook ACK would not establish government dispatch |
| Notifications | Hosted VAPID config enabled; browser service worker active; device status, disable and owned/rate-limited test-send actions; local outbox retry, deduplication, hidden-report suppression and privacy tests | Browser permission is denied; the user explicitly chose to leave notifications blocked. Real OS/background delivery remains unverified |
| Language and responsive UI | Cached label parity tests, native-script assistant checks, source language variants, 390px browser bounds and tab navigation checked | Route, notification, map and traffic/source diagnostics expanded in Kannada/Hindi; document lang and route/photo accessible names fixed. Provider text, some advanced help/diagnostics and proper names remain English; no native-speaker review or full assistive-technology certification |
| Recovery/privacy/security | Recovery/corruption tests, image metadata stripping, public projection rules and authorization regressions; dependency audits returned zero vulnerabilities | Separate private Blob store connected; existing daily maintenance cron now schedules database/photo snapshots with readback checks, seven-day retention and moderator-only status. Live isolated Firestore/new-Blob/local recovery drill passed and cleaned up. Auth/IAM/credentials are separate, and next scheduled invocation is not yet observed; see RECOVERY.md |

## Test evidence

The full `npm run test:all` gate passed with 33 frontend tests, 49 backend tests, a local API journey, eight sandbox scenarios and 24 stress checks. The production build and both dependency audits passed (zero reported vulnerabilities). Fixture scripts now assert actual results: the old invented rain-to-underpass-risk function was removed, TTL expiry is seeded before startup and must disappear, translation checks read actual JSON keys, and the reputation test calls the real module. These scripts do not impersonate multiple human QA reviewers or certify production safety.

Hosted privileged acceptance is repeatable through `scripts/verify-auth-moderation.js`. Optional `TEST_MEDIA=1` requires a Blob cleanup credential before creating an object. Tests use a unique temporary account/report, low-urgency report coordinates at the city boundary and cleanup scoped to that generated identity. Cleanup attempts all tasks even after another task fails.

## External gaps

IMD AWS observations returned HTTP 401 (`API key missing`). Current, anonymous KSNDMC/BTP machine-readable feeds and BMTC/BMRCL live vehicle feeds were not verified. These were not replaced with old or invented data. NDMA warnings and TomTom incidents provide useful current alternatives, with their own limits. See the primary-source links and research findings in SOURCE_RESEARCH.md.

## Follow-up hosted evidence

At 17:48 UTC on 5 November 2026, public hosted acceptance passed: current weather observed at 17:45 UTC, four junction speed samples, zero currently active official warnings, 301 provider incidents, current/future IST river dates, geocoding results, traffic PNG and configured push. Zero official warnings was an available empty feed, not an API failure. Counts vary normally.

Privileged hosted acceptance passed verified/unverified identity behavior, report persistence, moderation, private SOS owner access, a fresh Blob upload/retrieval/deletion, and current private-backup readiness. The assistant returned native-script weather replies and the non-weather response used `gemini-grounded` / `available`. Isolated fixture accounts/reports/photos were deleted. The separate live backup drill restored an uploaded photo into a new Blob URL and rebound the recovered Firestore/public projection records without starting any queue workers.

A read-only live route probe checked 306 current provider incidents against a 194-vertex, 5.8 km Majestic/MG Road route, found two proximity conflicts, and completed geometry matching in 5 ms on the local Node 24 environment. Its eight-minute estimate excludes live traffic. This is a single workload observation, not a capacity benchmark. Reproduce with `node scripts/verify-route-sources.mjs`.

Fresh hosted UI route interaction: typed Majestic and MG Road in the labeled inputs, calculated a route, and observed an alternative around provider `Queuing traffic`: 6.1 km, 11 min, +3 min versus the base estimate. The result retained the incomplete-conditions/static-time explanation. CSS-selector click automation timed out; a coordinate click through the same T3 browser succeeded. Browser evidence is therefore limited to those successful interactions, not a claim that every automation method worked.

Further review fixed two data-quality issues: newly selected waterlogging reports now default depth and passability to unknown instead of silently asserting ankle-deep/passable conditions, and traffic polling now checks every minute with refresh on visibility resume so a two-minute backend cache cannot leave readings stale between two-minute client polls. The latest 33-test frontend run includes the unknown-depth submission regression. Successful desktop pointer-open / Escape interaction restored focus to the initiating route button. Notification-block guidance fits inside the 390px viewport.

Two PR review regressions are covered by the final 35-test frontend run: device unsubscription still completes when the server returns 404 for a previous account, while other server failures remain visible; government-warning content no longer shadows interface translations, so issuance, validity and official-link labels remain present. The production build passed after these fixes.
