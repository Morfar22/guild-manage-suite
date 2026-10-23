// Runs from the host after `docker compose up --build --wait` and seed completion.
import assert from "node:assert/strict";
const base = "http://localhost:54321";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.yd7PkvVp1alMstuU_BcVdKX9vNCgah_DI3QsLPA1ARw";
const login = await fetch(`${base}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anonKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "demo@guildos.local",
    password: "GuildOS-local-demo-2026",
  }),
});
assert.equal(login.status, 200, await login.clone().text());
const session = await login.json();
const origin = "http://localhost:8080";
const preflight = await fetch(`${base}/rest/v1/guilds`, {
  method: "OPTIONS",
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization,apikey,x-client-info",
  },
});
assert.ok([200, 204].includes(preflight.status));
assert.ok(
  [origin, "*"].includes(preflight.headers.get("access-control-allow-origin")),
);
assert.match(preflight.headers.get("access-control-allow-headers"), /apikey/i);
const guilds = await fetch(`${base}/rest/v1/guilds?select=id,guild_id`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
    Origin: origin,
  },
});
assert.equal(guilds.status, 200, await guilds.clone().text());
assert.ok(
  [origin, "*"].includes(guilds.headers.get("access-control-allow-origin")),
);
assert.ok(
  (await guilds.json()).some((guild) => guild.guild_id === "demo_compose"),
);
const anonymousGuilds = await fetch(`${base}/rest/v1/guilds?select=id`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});
assert.equal(anonymousGuilds.status, 200, await anonymousGuilds.clone().text());
assert.deepEqual(await anonymousGuilds.json(), []);
const page = await fetch("http://localhost:8080/auth");
assert.equal(page.status, 200);
assert.match(await page.text(), /GuildOS/);
console.log("Local Compose smoke passed: login, RLS, demo guild, dashboard");
