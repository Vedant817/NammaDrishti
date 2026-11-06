# Eight-milestone implementation backlog

The user requested one feature at a time, incremental commits, three independent senior QA reviews, and a full application acceptance cycle after each feature. No existing eight-week specification was found in the repository. The weeks below are delivery milestones for the remaining requirements, not a claim that eight calendar weeks have elapsed. Expand scope only when evidence reveals a necessary repair.

| Milestone | Feature and subtasks | Exit evidence | External dependency |
|---|---|---|---|
| 1 | Backup reliability: freshness policy, attempt/failure/maintenance observability, lease/retention fault tests, moderator recovery status | Full suite/build; isolated live recovery; moderator/citizen browser journeys; QA findings resolved | First actual scheduler invocation observed separately from manual tests |
| 2 | IMD observations: documented authenticated adapter, station/time/units validation, bounded fetch and cache, explicit observation/model separation | Contract/fault tests and whole-app acceptance | Approved IMD access and a current documented payload; no invented station values |
| 3 | Calibrated depth observations: station identity/calibration/source contract, stale/invalid suppression, map/details and route provenance | Feed outage, bad calibration, boundary/time tests and whole-app acceptance | Authorized calibrated sensor feed and field verification |
| 4 | Bengaluru transit: authorized source onboarding, schedule-versus-live distinction, current-time vehicle/stop data, discoverable UI | GTFS/feed contract, stale/offline/empty tests and whole-app acceptance | Authorized current BMTC/BMRCL source and reuse terms |
| 5 | Emergency operator integration: authenticated recipient contract, ACK/retry/expiry reconciliation, operator-visible delivery state, call-112 path | Isolated recipient failure/recovery, privacy and whole-app acceptance | Actual recipient agreement; never contact an emergency agency during QA |
| 6 | Device notifications: account-switch/revocation lifecycle, explicit subscription/delivery state, privacy/retry diagnostics | Browser/service-worker plus outbox tests and whole-app acceptance | User chose to leave notifications blocked; respect that choice |
| 7 | Localization/accessibility: finish core UI labels, errors and dates; keyboard, touch, focus, screen-reader semantics | Language parity plus interaction/viewport regressions and whole-app acceptance | Native-speaker and physical assistive-technology review remain human acceptance |
| 8 | Operational release acceptance: reproducible heavy-user workload, realistic concurrency/outage scenarios, regression fixes, deployment and recovery evidence | Whole project exercised as ordinary and adversarial users; independent QA closure | Physical phone/emulator availability, external source credentials and agreements |

## Per-feature workflow

1. Reproduce the gap and define the contract, data provenance, failure modes and acceptance criteria.
2. Commit the plan/contracts, implement small reviewable subtasks and commit each coherent working change.
3. Run focused regressions, then the entire existing test suite, production build and dependency checks as appropriate.
4. Run the whole application in the T3 browser: reports, routing, account/moderation where authorized, traffic/weather/source views, settings, languages, mobile/desktop, failure/retry behavior. Never label fixtures as live production acceptance.
5. Obtain independent QA findings, reproduce and repair them, and repeat affected/full acceptance when justified.
6. Publish through a reviewed PR; merge only the checked head. Record actual deployment evidence and externally blocked checks separately.

## Current progress

- Baseline: main `134fd56`; working tree clean before starting. Node 24.13.1 and npm 11.8.0 available.
- Three read-only QA agents assigned: app journeys, operational reliability, and provider contracts. Parent owns all implementation and shared-browser interaction.
- Milestone 1: implementation and regression repairs complete; full local/browser/live-isolated acceptance and release review in progress. Milestones 2–8: pending. No external live integration is marked complete without actual access and acceptance evidence.
