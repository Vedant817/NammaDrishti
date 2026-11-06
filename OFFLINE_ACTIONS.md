# Account-bound offline actions contract

This feature closes QA-01, QA-02 and QA-04. Public event snapshots remain separate from private account-owned reports and votes. No local confirmation is a guarantee of delivery.

## Subtasks and commits

1. Pin authenticated mutations to UID and session generation, including before token acquisition and after it resolves. Same-UID anonymous linking remains valid; UID/session switches cancel old work.
2. Use IndexedDB transactions for per-owner actions and acknowledged vote markers. Stable action IDs, revisions and claims protect concurrent tabs and stale completion. A successful request is not a durable write until the transaction completes.
3. Implement bounded replay with persisted backoff, typed ACK validation, photo URL checkpoints, recoverable account/verification blocks and terminal rejections. Never remove the only draft on malformed ACKs or network uncertainty.
4. Integrate a private saved-actions view, explicit retry/edit/discard actions and accurate submission feedback. Storage failures preserve the report form and photo. Remove private drafts and optimistic votes from the shared public cache.
5. Run real IndexedDB transaction tests, adversarial identity/replay interleavings, full-project acceptance and isolated browser account-switch/reload journeys. Obtain independent QA review before release.

## Safety and compatibility

- Owner identity comes from Firebase/current local principal, never caller-supplied payload fields. Check the same session at every upload/report boundary. Requests already dispatched may commit; later responses cannot mutate another session's UI.
- Anonymous registration by credential linking preserves UID and drafts. Signing into another account or signing out must not transfer actions. Cross-tab Firebase auth changes count as session changes.
- Legacy device-global queues, cached pending drafts and vote markers are unowned. Preserve their old keys, exclude them from public-cache hydration and automatic sending, and surface a quarantine notice without revealing their contents to a new account.
- New private actions are never inserted into the public map/feed before acknowledgement. Pending/failed items remain visible only in the owner's saved-actions view.
- Reports/votes use stable immutable IDs, revision-fenced updates and per-action claims. ACK only the intended record. Do not deduplicate by timestamp or rewrite a stale whole queue array.
- Persist a received uploaded-photo URL before report POST. Lost upload ACKs remain uncertain: the provider uses unique objects, so the client cannot promise exactly-once photo upload.
- Network/timeout/429/5xx are retryable with bounded durable backoff. 401/verification-required 403 are blocked until explicit same-owner recovery. Validation/moderation/missing-target failures retain a terminal draft, not an indefinitely pending action.
- Browser storage is device-local and can be cleared/evicted by the browser. Account-scoped storage is not encryption against a person with local developer-tool access. Unsupported/blocked/full storage must fail visibly, without a false saved claim.
- Local Firebase-unconfigured mode proves only standalone behavior. Hosted isolation acceptance requires authorized synthetic Firebase identities. No real account claims or notification permission will be changed.
