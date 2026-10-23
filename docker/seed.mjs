// Known fixtures for the loopback-only Compose stack. No provider account needed.
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = "demo@guildos.local";
const password = "GuildOS-local-demo-2026";
const userId = "00000000-0000-4000-8000-000000000001";
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function api(path, options = {}, attempt = 0) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const body = await response.text();
  // PostgREST reloads its schema asynchronously after the migration job notifies
  // it. Retry only safe reads while the new schema becomes visible.
  if (
    !options.method &&
    path.startsWith("/rest/v1/") &&
    [404, 503].includes(response.status) &&
    attempt < 30
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return api(path, options, attempt + 1);
  }
  if (!response.ok)
    throw new Error(`${path}: HTTP ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

// Re-runs preserve the same account and demo guild.
const users = await api("/auth/v1/admin/users?page=1&per_page=1000");
let user = users.users.find((entry) => entry.email === email);
if (!user) {
  user = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      id: userId,
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Local demo" },
    }),
  });
}

const guilds = await api("/rest/v1/guilds?guild_id=eq.demo_compose&select=id");
let guild = guilds[0];
if (!guild) {
  [guild] = await api("/rest/v1/guilds", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      guild_id: "demo_compose",
      guild_name: "Local Demo Server",
      owner_id: user.id,
      command_prefix: "!",
    }),
  });
}
await api("/rest/v1/user_guilds?on_conflict=user_id,guild_id", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({
    user_id: user.id,
    guild_id: guild.id,
    discord_user_id: user.id,
    has_admin_permission: true,
  }),
});
await api("/rest/v1/guild_modules?on_conflict=guild_id,module_type", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates" },
  body: JSON.stringify(
    ["moderation", "music", "leveling", "utility", "fun"].map(
      (module_type) => ({
        guild_id: guild.id,
        module_type,
        enabled: true,
      }),
    ),
  ),
});
console.log(
  JSON.stringify({
    level: "info",
    message: "Local demo account and guild are ready",
    url: "http://localhost:8080/auth",
    email,
  }),
);
