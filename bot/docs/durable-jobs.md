# Durable scheduled jobs

`reminders`, `scheduled_messages`, and `scheduled_actions` use the same service-role-only queue RPCs. Apply `20261110182703_bot_reliable_delivery.sql` before deploying the handlers. It also aligns the reminder columns used by the persistent `/remind` command with older production schemas.

The migration replaces legacy public policies on these three queues with guild-admin/platform-staff access. Browser clients can create and edit schedule content but cannot write delivery flags, status, attempts or leases. Processing jobs cannot be edited or deleted by browser clients. Membership rows must already be server-managed; deploy the existing membership-lockdown migration first on older installations.

A row starts `pending`, becomes `processing` only after an atomic database claim, and becomes `sent` only after Discord confirms delivery/execution. The legacy `sent`, `is_sent`, and `executed` flags change only on success. A 90-second lease is renewed every 30 seconds while delivery is in progress. A crashed worker's lease can be reclaimed, and its old token cannot acknowledge or extend the replacement lease.

Explicit missing destinations, missing permissions and invalid actions become `failed`. Transient errors retry up to five attempts, with 30, 60, 120 and 240-second backoff. Queue state, attempts and the last error survive restarts. The dashboard displays failures separately from successful deliveries. Recurring jobs create their next future occurrence in the same database transaction as completion; an occurrence has at most one child. Failed recurring occurrences do not silently advance.

Discord delivery and database completion cannot be committed as one transaction. Deterministic Discord message nonces with `enforceNonce` reduce duplicate messages during recent crash/network recovery. Discord only deduplicates recent nonces, so a prolonged outage after Discord accepted a message but before the database acknowledged it can still produce a duplicate. This is an at-least-once delivery system, not an exactly-once guarantee. A successful Discord send followed by a database error remains leased instead of being recorded as a failed send.

Role changes, bans and unbans set an idempotent final state. A retried mute uses the original scheduled time plus one hour, so it does not extend the timeout on every attempt. Kicks are different: an expired kick lease or an ambiguous kick transport/5xx failure becomes `failed` with an instruction to inspect Discord. It is never automatically repeated against someone who may have rejoined.

For a failed job, inspect `last_error`, correct the channel/permissions/target, and check Discord before scheduling a replacement. This is especially important when the outcome is unknown. Historical rows already marked sent/executed are not replayed by the migration, because their original outcomes cannot be reconstructed reliably.

## Verification

Run `node --test tests/durable-jobs.node.mjs tests/round2-regressions.node.mjs` for SQL/handler failure, retry, stale-worker, recurrence and RLS coverage. PGlite runs the real migration and SQL functions; it serializes connections.

For real connection contention, use an isolated empty Postgres database. Load `tests/fixtures/durable-jobs-schema.sql`, the migration, and `tests/fixtures/durable-jobs-concurrency-setup.sql`. Race `durable-jobs-concurrency-race.sql` from at least eight independent psql sessions, then run `durable-jobs-concurrency-assert.sql`. Never load the test schema or fixture data into production.
