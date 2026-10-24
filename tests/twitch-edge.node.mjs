import assert from "node:assert/strict";
import { test } from "node:test";
import { loadHandler } from "./mocks/edge-loader.mjs";

function database(respond) {
  const queries = [];
  return {
    queries,
    from(table) {
      const query = { table, operation: "select", filters: [], columns: "*" };
      queries.push(query);
      return {
        select(columns = "*") {
          query.columns = columns;
          return this;
        },
        eq(column, value) {
          query.filters.push([column, value]);
          return this;
        },
        in(column, value) {
          query.filters.push([column, value]);
          return this;
        },
        update(values) {
          query.operation = "update";
          query.values = values;
          return this;
        },
        insert(values) {
          query.operation = "insert";
          query.values = values;
          return this;
        },
        maybeSingle() {
          return Promise.resolve(respond(query));
        },
        then(resolve, reject) {
          return Promise.resolve(respond(query)).then(resolve, reject);
        },
      };
    },
  };
}

function edge(client, fetch) {
  const runtime = loadHandler("supabase/functions/twitch-handler/index.ts", {
    supabase: client,
    fetch,
  });
  runtime.env.TWITCH_CLIENT_ID = "test-twitch-client";
  runtime.env.TWITCH_CLIENT_SECRET = "test-twitch-secret";
  return runtime;
}

function request(action) {
  return new Request(`https://edge.invalid/twitch-handler?action=${action}`, {
    headers: { "x-bot-secret": "test-secret" },
  });
}

test("Edge Twitch partner warnings query guild_name and use it in the actual Discord DM", async () => {
  const messages = [];
  const client = database((query) => {
    if (query.table === "admin_ip_whitelist")
      return { data: null, count: 0, error: null };
    if (query.table === "twitch_settings") {
      // Match PostgREST's rejection of an unknown column in the guild relation.
      if (/\bname\b/.test(query.columns)) {
        return {
          data: null,
          error: Error("column guilds.name does not exist"),
        };
      }
      return {
        data: [
          {
            guild_id: "guild-a",
            guilds: {
              id: "guild-a",
              guild_id: "discord-guild-a",
              guild_name: "Our streaming guild",
            },
            partner_warning_days_before: 7,
            partner_warning_dm: "{server}: {progress}/{goal}",
          },
        ],
        error: null,
      };
    }
    if (query.table === "twitch_streamers" && query.operation === "select")
      return {
        data: [
          {
            id: "streamer-a",
            twitch_username: "streamer",
            display_name: "Streamer",
            discord_user_id: "discord-user-a",
            last_quota_reset_at: new Date().toISOString(),
            quota_type: "streams",
            quota_streams_per_week: 2,
            current_week_streams: 0,
            warning_sent_this_week: false,
          },
        ],
        error: null,
      };
    return { data: null, error: null };
  });
  const runtime = edge(client, async (input, init) => {
    const url = new URL(input);
    if (url.pathname === "/api/v10/users/@me/channels")
      return Response.json({ id: "dm-a" });
    if (url.pathname === "/api/v10/channels/dm-a/messages") {
      messages.push(JSON.parse(init.body));
      return Response.json({ id: "message-a" });
    }
    throw Error(`Unexpected external request: ${url}`);
  });
  const response = await runtime.call(request("partner_check"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    warnings: 1,
    resets: 0,
    checked: 1,
  });
  assert.deepEqual(messages, [
    { content: "Our streaming guild: 0 streams/2 streams" },
  ]);
  assert.ok(
    client.queries.some(
      (query) =>
        query.operation === "update" &&
        query.values.warning_sent_this_week === true,
    ),
  );
});

for (const contentType of ["clip", "vod"]) {
  test(`Edge Twitch ${contentType} delivery posts to the channel configured in guild settings`, async () => {
    const deliveries = [];
    const streamer = {
      id: "streamer-a",
      guild_id: "guild-a",
      twitch_user_id: "123",
      twitch_username: "streamer",
      display_name: "Streamer",
      is_live: false,
    };
    const channelId =
      contentType === "clip" ? "guild-clips-channel" : "guild-vods-channel";
    const client = database((query) => {
      if (query.table === "admin_ip_whitelist")
        return { data: null, count: 0, error: null };
      if (query.table === "twitch_streamers")
        return { data: [streamer], error: null };
      if (query.table === "twitch_settings")
        return {
          data: [
            {
              guild_id: "guild-a",
              clips_channel_id: "guild-clips-channel",
              vods_channel_id: "guild-vods-channel",
              notify_clips: contentType === "clip",
              notify_vods: contentType === "vod",
            },
          ],
          error: null,
        };
      return { data: null, error: null };
    });
    const runtime = edge(client, async (input, init) => {
      const url = new URL(input);
      if (url.hostname === "id.twitch.tv")
        return Response.json({ access_token: "test-access" });
      if (url.pathname === "/helix/streams") return Response.json({ data: [] });
      if (url.pathname === "/helix/clips")
        return Response.json({
          data: [
            {
              id: "clip-a",
              title: "New clip",
              url: "https://clips.invalid/clip-a",
              thumbnail_url: "https://cdn.invalid/clip-a",
              view_count: 1,
              duration: 30,
              creator_name: "Creator",
              created_at: new Date().toISOString(),
            },
          ],
        });
      if (url.pathname === "/helix/videos")
        return Response.json({
          data: [
            {
              id: "vod-a",
              type: "archive",
              title: "New VOD",
              url: "https://videos.invalid/vod-a",
              thumbnail_url: "https://cdn.invalid/%{width}x%{height}",
              view_count: 1,
              duration: "1h",
              created_at: new Date().toISOString(),
            },
          ],
        });
      if (url.hostname === "discord.com") {
        deliveries.push({ path: url.pathname, body: JSON.parse(init.body) });
        return Response.json({ id: "message-a" });
      }
      throw Error(`Unexpected external request: ${url}`);
    });
    const response = await runtime.call(request("check"));
    assert.equal(response.status, 200);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].path, `/api/v10/channels/${channelId}/messages`);
    assert.equal(deliveries[0].body.embeds.length, 1);
    const post = client.queries.find(
      (query) =>
        query.table === "twitch_content_posts" && query.operation === "insert",
    );
    assert.equal(post.values.channel_id, channelId);
    assert.equal(post.values.content_type, contentType);
  });
}
