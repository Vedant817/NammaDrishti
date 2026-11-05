# Backup and recovery

Production snapshots are stored in a separate **private** Vercel Blob store, connected as `BACKUP_READ_WRITE_TOKEN`. Public photo uploads continue using `BLOB_READ_WRITE_TOKEN`; `MEDIA_BLOB_HOST` identifies that store so external image links cannot block managed-photo backups. Neither token belongs in frontend variables or Git.

The existing authenticated `/api/maintenance` cron runs daily at 03:00 UTC (08:30 IST). After maintenance, it snapshots Firestore `incidents`, `moderationAudit`, `emergencyOutbox`, `pushSubscriptions` and `pushOutbox` in a read-only transaction, then includes the immutable uploaded photos referenced by reports and their updates. Unreferenced uploads and external image links are not copied. Public projections can be rebuilt from private incidents. Firebase Auth users, provider credentials, IAM, rules and deployment configuration are separate recovery requirements; this archive is not a complete Firebase project export.

Snapshots use checksums for records, media manifest and photo bytes. The service uploads a compressed private archive, reads it back, validates it, then records success in `_coordination/dailyBackup`. A transaction lease prevents concurrent daily snapshots. Successful runs retain seven days of archives. Backup deletion is scoped to the backup prefix in the private store; it never deletes live report photos. A failed photo read or budget overflow fails the backup rather than silently omitting an uploaded photo. Limits are 5,000 records per collection, 32 MiB of records and 32 MiB of photo bytes per snapshot. Review quotas and increase the architecture before those limits are reached.

`GET /api/operations` is moderator-only and exposes backup configuration, status, last completed time and counts, without the private download URL. A stale completion time or failed status needs operator investigation. Daily recovery-point target is roughly 24 hours plus cron delay; the next scheduled cron execution has not yet been observed. This is cross-provider storage, not an independent second Vercel account or protection against compromise of the entire Vercel account. Retained private records can remain in snapshots for seven days after live deletion.

## Download and rehearse

Use the private store dashboard or authenticated Blob CLI to download an archive into a private directory outside this repository. Do not paste tokens or private archives into chat. With the correct private-store credentials selected:

```powershell
vercel blob get <private-archive-url> --access private --output C:/private/backup.json.gz
npm run restore -- --from C:/private/backup.json.gz
npm run restore -- --from C:/private/backup.json.gz --apply --to C:/private/new-recovery-directory
```

The first restore command validates without writing. The second requires a new directory and restores `incidents.json`, `records.json` and `media/`, rebinding uploaded photo URLs to local media paths. Existing directories are rejected. Version 1 archives remain readable but contain no photos. Do not start a production worker against restored queues: queued push/SOS work must be reconciled with actual recipient acknowledgements and expiry first.

For a hosted recovery drill, provide local ADC, `FIREBASE_PROJECT_ID`, `BLOB_READ_WRITE_TOKEN` and `BACKUP_READ_WRITE_TOKEN` and `MEDIA_BLOB_HOST`, then run:

```powershell
node scripts/verify-backup-recovery.js
```

The drill creates uniquely prefixed Firestore collections and one tiny photo. It captures a private archive under its own `drills/` prefix, asserts anonymous download is rejected, restores bytes locally, uploads a new immutable photo, and restores records plus their sanitized public projection into separate Firestore collections with the new photo URL. It checks hashes and readback, never starts a worker, and cleans up all its own objects and records. It does not overwrite production collections or change roles/accounts. This live drill passed on 5 November 2026. A separate initial production snapshot completed with zero records and zero photos at the time of the run.

## Recovery to production

Rehearse first. Keep the API writer and notification/emergency processors stopped, select the intended archive/project, restore photos to new immutable managed URLs, rewrite report/update references, restore private collections in bounded batches and rebuild `publicIncidents` using `publicIncident`. Review expired records and delivered outbox jobs before enabling processors. Restore Auth users/rules and provider credentials from their separately managed sources. Re-run authorization, media and realtime acceptance before restoring traffic. Production replacement is deliberately not an unattended restore action.
