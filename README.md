# NammaDrishti

A Bengaluru civic reporting map built with React, Vite, Express, Socket.IO and Firebase. Citizens can report hazards, confirm reports, vote to clear them, inspect past radar observations and plan routes against current reports.

Reports and model weather estimates can be incomplete. Absence of reports does not establish that a road is clear. Call **112** for emergency assistance; saving or sharing a location does not confirm emergency-service dispatch.

Public site: https://nammadrishti.vercel.app/ · [Citizen account](https://nammadrishti.vercel.app/?account=1)

The Vercel-only deployment and latest hosted/browser evidence are recorded in [DEPLOYMENT.md](DEPLOYMENT.md). Hosted realtime uses a sanitized, read-only Firestore projection; standalone Node retains Socket.IO.

The **Public alerts** tab combines active NDMA SACHET government warnings and TomTom road incidents, with source links, validity windows and Bengaluru dates. See [SOURCE_RESEARCH.md](SOURCE_RESEARCH.md) for the source investigation and [FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) for feature-by-feature evidence and limits.

## Run locally

Use Node 22.12+ or 24, then:

```powershell
npm ci
npm ci --prefix server
npm run server
# In another terminal:
npm start
```

Local development without Firebase uses an empty JSON incident store. Production requires Firebase Admin credentials and the public Firebase web settings in [.env.example](.env.example). Admin credentials and provider keys stay on the server. Configure email/password authentication in Firebase; the project's provider has been enabled. Citizen account supports registration, email verification and sign-in. Production reporting and voting require a verified email by default. Email accounts are not proof of unique humans.

## Features and limits

- Reports persist before acknowledgment. Same contributor counts once across reporting and confirmation. GPS is not proof of presence. Resolution requires two distinct accounts.
- Firestore instances coordinate incident writes with a lease checked inside the write transaction. Each mutation reloads the latest index. Followers receive snapshots. Busy or expired writers fail rather than overwrite another replica. Local JSON mode supports one process.
- Active routes retain endpoints and recompute after incident changes, even after closing the dialog. Disconnected or failed checks show an uncertain state. OSRM estimates exclude live traffic; the bounded waypoint search does not guarantee a hazard-free route.
- Open-Meteo is a model, not a flood sensor. The UI shows the observation timestamp, precipitation amount and accumulation interval. Derived hourly rates are calculated from that interval.
- RainViewer shows past observations only, overzoomed from native zoom 7. Missing/stale tiles or incomplete coverage do not mean no rain.
- Place searches require Search, Enter or report submission. Nominatim requests share a server cache and an application-wide gate in Firebase mode. No autocomplete. Operators can change the upstream endpoint without rebuilding the frontend.
- Traffic speeds use an optional server-side TomTom adapter. Without access, measured traffic is unavailable. Citizen report density remains a separate source.
- Underpass coordinates are unverified candidate locations. Unsourced equipment, depth and engineered-threshold claims have been removed. Per-location model estimates and nearby reports are distinguished from optional sourced depth observations.
- Photos are decoded with bounded pixels and re-encoded as WebP, removing EXIF/GPS metadata. Hosted production uses uniquely named, immutable Vercel Blob objects; local development uses persistent disk. Incident documents store URLs. No paid Firebase Storage upgrade was made.
- Assistant summaries use server-owned reports and weather, ignoring client-supplied readings. Optional Gemini responses identify their mode and use bounded public report context. Without credentials, this is a grounded summary, not an LLM.
- SOS locations use a private durable outbox, deadlines and bounded retries. The recipient must acknowledge the matching dispatch ID. An operator acknowledgment does not imply government dispatch. Location records expire after 24 hours. Optional webhook recipients must deduplicate `Idempotency-Key`.
- Moderator accounts need the `moderator: true` Firebase custom claim and a non-anonymous identity. The Citizen account panel includes hide/restore, reason entry, audit history and operations metrics. The backend needs Firebase Auth viewer permission for revoked-token checks, in addition to datastore access.
- Optional Web Push requires VAPID settings, HTTPS, a built service worker and explicit permission. Subscriptions refer to a saved area, expire after 30 days, and delivery retries are durable. Device/background delivery still requires acceptance on the intended browser/device.
- English, Kannada and Hindi cover the core interface, account, overview and assistant summaries. Proper names, provider names, user reports and some diagnostic messages remain in their source language; key parity is not a complete linguistic review.

## Validation

```powershell
npm run test:all
npm run build
npm audit
npm audit --prefix server
# Read-only hosted source/date checks:
# Set ACCEPTANCE_API_URL=https://nammadrishti.vercel.app/api first.
npm run test:live-sources
node scripts/verify-firestore.js
# Optional privileged acceptance: requires a Firebase CLI owner login.
node scripts/verify-auth-moderation.js
```

The last two scripts use live Firebase, create isolated test fixtures and remove them. `verify-auth-moderation` temporarily starts a server on 5023. Set `FIREBASE_CLI_ROOT` if Firebase CLI is not installed beside Node. Tests using local fixtures do not establish provider coverage or production delivery. See [ACCEPTANCE.md](ACCEPTANCE.md) for the current evidence and open gates.

## Recovery and operation

```powershell
npm run backup -- --output C:/private-backups/civic-2026-11-05.json
npm run restore -- --from C:/private-backups/civic-2026-11-05.json
npm run restore -- --from C:/private-backups/civic-2026-11-05.json --apply --to C:/private-recovery/new-directory
```

Backups include incidents, moderation audit, SOS and notification records. They contain private data: use a restricted directory outside the repository, encrypt off-host copies, and schedule the command with the operator's scheduler. The checksum detects accidental corruption; it is not an authenticity signature. Restore defaults to validation only and writes only to a new local directory. Back up `MEDIA_DIR` separately; URL-only records cannot recover attachment bytes. The automated recovery test proves JSON/outbox restoration and corruption rejection. A full production disaster recovery rehearsal remains an operator gate.

`/api/health` reports readiness; `/api/operations` requires moderator access and reports source failures/configuration, uptime and replica mode. Connect these to the hosting platform's monitoring and alerts. Docker Compose mounts persistent state; replicas also require shared media storage, matching provider/VAPID configuration and properly configured trusted proxies. Configure backups and verify hosted monitoring before production use.

Source contracts: [DATA_SOURCES.md](DATA_SOURCES.md). License: [LICENSE](LICENSE).
