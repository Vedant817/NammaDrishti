# Independent QA findings

Audits were read-only against baseline main `134fd56`; they are code findings and isolated reproductions, not production failures. Parent owns repairs. Each item requires a regression and affected/full application acceptance before closure.

| ID | Priority | Finding | Milestone | State |
|---|---|---|---|---|
| QA-01 | P1 | Offline actions and vote markers can cross Firebase account boundaries | 6 (release blocker) | Open |
| QA-02 | P2 | Failed durable offline save still reports successful submission and loses the draft on reload | 6 | Open |
| QA-03 | P2 | Dismissed initial route calculation can overwrite or clear a newer journey | 8 | Open |
| QA-04 | P2 | Permanently rejected offline reports remain pending and retry indefinitely | 6 | Open |
| QA-05 | P2 | Emergency UI never observes owner-only ACK/failure status | 5 | Open |
| QA-06 | P2 | Moderator UI hides fetched backup status | 1 | In progress |
| QA-07 | P2 | Road incidents are buried behind zero government warnings and absent from Traffic shortcuts | 7 | Open |
| QA-08 | P2 | Expired outbox lease owner can overwrite a newer acknowledgement | 5/6 | Open |
| QA-09 | P2 | Non-atomic push enqueue can resurrect an already sent job | 6 | Open |
| QA-10 | P2 | Stale outbox list snapshot bypasses persisted retry backoff | 5/6 | Open |
| QA-11 | P2 | Backup readback failures leave untracked uploaded archives | 1 | In progress |
| QA-12 | P2 | Incident cleanup/outbox failures suppress the day's backup | 1 | In progress |
| QA-13 | P2 | Uncaught operations storage rejection can terminate Express 4 | 1 | In progress |
| QA-14 | P2 | Cached weather retains fresh flags after its observation expires | 2 | Open |
| QA-15 | P2 | Malformed active provider closures disappear without partial-coverage status | 8 | Open |
| QA-16 | P2 | Negative speeds and confidence outside [0,1] are accepted | 8 | Open |

External gates: approved IMD contract/credentials (AWS auth header, timestamp zone and rainfall units are not documented sufficiently in the public sample); calibrated sensor registry/feed and field verification; authorized current transit resource; actual dispatch recipient agreement; notification permission (user chose blocked); actual scheduled cron invocation; physical device/native-speaker acceptance. No external gate can be replaced by a fixture or marked passed by static tests.
