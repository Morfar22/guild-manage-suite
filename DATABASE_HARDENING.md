# Guild membership and partner statistics

Apply `supabase/migrations/20261016093000_lock_down_guild_membership.sql`
before exposing the updated API to users.

The migration removes browser-controlled server membership creation and public
read/write access to Twitch partner statistics. Existing administrator flags for
real Discord servers are invalidated because the previous policy allowed users
to create them. Users must sign in with Discord again to verify their access.
Intentionally assigned special access should be reviewed and assigned again by
a platform administrator. Demo-server flags are preserved.

The demo endpoint now generates a demo identifier on the server and never accepts
an actual Discord server identifier from the request.

The new tests execute the database migration in embedded PostgreSQL and exercise
both demo endpoint implementations with mocked dependencies. Run `npm test`.
No production database changes are performed by these tests.
