# Feature acceptance — 5 November 2026

This record separates local assertions, live hosted API tests, browser checks and external acceptance gaps. No test establishes complete official coverage or road safety. Data counts change as providers update; they are observations from the test run, not fixed product totals.

## Everyday UI update

Navigation now starts with Today, Reports and Help. Today offers a compact summary with links to detailed traffic, warnings and rainfall. Report filters live with Reports; map layers and notification settings are collapsed until requested. Map selection offers an explicit Report here action rather than interrupting browsing with a form. New navigation/guidance supports English, Kannada and Hindi. Desktop and small-screen CSS retain large controls, readable text and keyboard focus.

This UI update passed 26 frontend tests and the production build. Regression tests cover navigation, reporting and route dialogs, non-interrupting map selection, layer toggles, translation key parity and missing weather remaining unknown. The hosted browser evidence below belongs to the preceding feature audit; a new browser layout review was not performed for this UI-only request.

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
| Route planning | Browser Majestic → MG Road: 6.1 km, 8 min static ETA, route shown on map; reactive-route tests retained | Checks use citizen reports; Public alerts supplies separate provider closures. No guaranteed avoidance or live traffic ETA |
| Routing outage fallback | Invalid backup hostname replaced with documented FOSSGIS endpoint; direct real route returned `Ok`; coalescing/cache regression added | Public demo services are for light use; per-browser spacing is not an unlimited service guarantee |
| Assistant | Live weather response in English/Kannada/Hindi; latest non-weather call returned `gemini-grounded` and `available` | Earlier calls fell back; the UI now labels AI-unavailable and cached-summary modes. Model answers remain advisory |
| Emergency location | Hosted location-only save, owner status read and unauthenticated 404; private fixture removed; five local dispatch ACK/retry/expiry scenarios pass | No emergency agency was contacted. A webhook ACK would not establish government dispatch |
| Notifications | Hosted VAPID config enabled; browser service worker active | Browser permission is denied, so real OS/background delivery remains unverified |
| Language and responsive UI | Cached label parity tests, native-script assistant checks, source language variants, 390px browser bounds and tab navigation checked | Proper names, provider text and some new source diagnostics remain English; no complete linguistic review |
| Recovery/privacy/security | Recovery/corruption tests, image metadata stripping, public projection rules and authorization regressions; dependency audits returned zero vulnerabilities | Hosted off-site backup scheduling and a full Blob+Firestore recovery drill remain operator work |

## Test evidence

The full `npm run test:all` gate passed with 23 frontend tests, 45 backend tests, a local API journey, eight sandbox scenarios and 24 stress checks. The production build and both dependency audits passed (zero reported vulnerabilities). Fixture scripts now assert actual results: the old invented rain-to-underpass-risk function was removed, TTL expiry is seeded before startup and must disappear, translation checks read actual JSON keys, and the reputation test calls the real module. These scripts do not impersonate multiple human QA reviewers or certify production safety.

Hosted privileged acceptance is repeatable through `scripts/verify-auth-moderation.js`. Optional `TEST_MEDIA=1` requires a Blob cleanup credential before creating an object. Tests use a unique temporary account/report, low-urgency report coordinates at the city boundary and cleanup scoped to that generated identity. Cleanup attempts all tasks even after another task fails.

## External gaps

IMD AWS observations returned HTTP 401 (`API key missing`). Current, anonymous KSNDMC/BTP machine-readable feeds and BMTC/BMRCL live vehicle feeds were not verified. These were not replaced with old or invented data. NDMA warnings and TomTom incidents provide useful current alternatives, with their own limits. See the primary-source links and research findings in SOURCE_RESEARCH.md.
