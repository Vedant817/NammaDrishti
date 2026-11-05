# Acceptance record — 2026-11-05

The newer Vercel deployment evidence and resolved/open gates are in [DEPLOYMENT.md](DEPLOYMENT.md). The matrix below records the earlier PR baseline.

## Verified in this change

- Production frontend build succeeds after migration from CRA to Vite. Explicit frontend environment allowlist excludes Admin/provider secrets.
- 13 frontend tests: existing UI flows plus active-route incident refresh, offline uncertainty and superseded-response rejection.
- 28 backend tests: original API/security regressions plus interval conversion, missing/stale weather, concurrent geocoder serialization/cache, unconfigured traffic, durable SOS retry/ACK, trusted assistant context backup restore/corruption rejection, and image decoding/metadata stripping.
- Local user journey, 8 sandbox scenarios and 24 stress checks pass. These include fixtures and simulated geometry, not live sensor or device acceptance.
- Docker image builds and boots with live Firestore, serves the SPA, re-encodes an image with the Linux native library, and excludes local runtime state and `.env`.
- Root and server npm audits report zero vulnerabilities after replacing the unsupported build dependency chain and updating transitive dependencies.
- Live Firebase: isolated Firestore lease ownership, cross-replica load/commit, rejection of unowned writes. Temporary collections removed.
- Live Firebase: email/password provider enabled; verified-email account sign-in, authenticated durable report, non-moderator rejection, moderator hide/restore and hidden-ID replay rejection. Temporary account/report/audit fixtures removed.
- Backend service account retains datastore access and gains Firebase Auth viewer solely for revoked-token checks. It has no new account-management write role.

## External acceptance gates still open

| Gate | Current state | Required proof |
|---|---|---|
| Traffic feed | Adapter implemented; no key delivered | Valid authorized key, Bengaluru coverage, confidence/age checks and actual speed display |
| Gemini | Adapter implemented; deterministic summary used | Authorized key/model, latency and grounded-answer review in all three languages |
| Official flood observations | Adapter implemented; no authorized source | Feed access, source provenance, calibrated locations/depth units and live timestamps |
| Underpass engineering catalog | Unsourced claims removed; locations explicitly unverified | Field review and per-location authoritative source URLs/review dates |
| RainViewer Bengaluru coverage | Correct native zoom/age handling | Confirm live coverage at intended times; a transparent tile is not proof of no rain |
| Emergency dispatch | Durable location/outbox and operator ACK implemented | Authorized recipient agreement and end-to-end delivery test; an operator ACK is not official dispatch |
| Background push | Durable subscriptions/outbox/service-worker handlers implemented | VAPID configuration, HTTPS and physical-device/background permission/delivery test |
| Full localization | Core flows expanded; source-language diagnostics remain | Native linguistic review and remaining diagnostic/accessibility copy coverage |
| Production monitoring/recovery | Readiness/role-protected metrics and backup/recovery tools implemented | Hosted alerts, scheduled off-host encrypted backups, shared media storage and full disaster recovery drill |
| Sustained hosted multi-client use | Local concurrency and live repository coordination tested | Long-running hosted cross-client/offline/reconnect test and capacity measurements |

This is not a claim that all features work with live official data. Provider adapters and local passing tests do not establish those gates. No production application deployment or paid Firebase Storage activation was performed.
