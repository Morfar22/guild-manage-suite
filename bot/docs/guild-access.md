# Discord administrator verification

`user_guilds` is server-managed. Discord OAuth confirms a real server administrator and records a two-minute `admin_verified_until`. The assigned bot force-fetches the guild, roles and linked member every minute before renewing that claim. Member removal, member role changes, role changes, ownership changes and bot removal invalidate existing claims and request a new check. An unavailable Discord API never renews access.

Server routes read `verified_user_guilds`, a security-invoker view containing only unexpired administrator claims. The underlying own-link SELECT policy also hides expired positive claims, so existing guild RLS joins enforce the same expiry for direct browser/Data API requests. Privileged platform roles remain an independently managed authorization path where the application already supports them.

If event delivery is interrupted, authorization expires within two minutes of its last successful verification. A server without a reachable assigned bot needs a fresh Discord OAuth verification to reopen that short window. Existing cached pages cannot grant database or API access. Platform-admin grants alone do not invent Discord administrator permission for ordinary users.

Server-created demo access is recorded separately. Browsers cannot change a guild's Discord identity or owner. The sensitive backup, webhook and raid-protection policies admit only that guild's verified administrators or platform staff. Console logs are backend-written; system logs with a null guild are visible only to platform staff.

Apply the access migration before running the verifier or deploying routes that query the new view. Preserve the separate sensitive-table migration and its restricted grants. Never restore a permissive policy just to resolve an access error; inspect verification expiry and the bot's ability to confirm the linked Discord identity instead.
