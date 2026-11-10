import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
const U = "20000000-0000-4000-8000-000000000001",
  V = "20000000-0000-4000-8000-000000000002";
const migration = async (name) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
async function as(db, role, user, sql) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("RESET ROLE");
  }
}
test("live-style legacy policies are closed and expired Discord claims fail for both REST and service APIs", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   CREATE FUNCTION public.has_admin_or_staff_role(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(current_setting('test.staff',true),'false')='true'$$;
   CREATE TABLE public.guilds(id uuid PRIMARY KEY,guild_id text,owner_id text,guild_name text,guild_icon text,command_prefix text,log_channel_id text,auto_moderation_enabled boolean,updated_at timestamptz,whitelist_role_id text,staff_role_id text,automod_bypass_role_ids text[]);
   CREATE TABLE public.user_guilds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,guild_id uuid REFERENCES public.guilds(id),discord_user_id text,has_admin_permission boolean,created_at timestamptz DEFAULT now());
   ALTER TABLE public.user_guilds ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can view their own guild links" ON public.user_guilds FOR SELECT TO authenticated USING(user_id=auth.uid());
   CREATE POLICY staff_links ON public.user_guilds FOR ALL TO authenticated USING(public.has_admin_or_staff_role(auth.uid())) WITH CHECK(public.has_admin_or_staff_role(auth.uid()));
   CREATE TABLE public.server_backups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid,payload text);
   CREATE TABLE public.webhook_configs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid,payload text);
   CREATE TABLE public.raid_protection_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid,payload text);
   CREATE TABLE public.bot_console_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL,payload text);
   DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['server_backups','webhook_configs','raid_protection_settings','bot_console_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY legacy_public ON public.%I FOR ALL USING(true) WITH CHECK(true)',t);
   END LOOP;END$$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
   INSERT INTO public.guilds(id,guild_id,owner_id) VALUES('${A}','111111111111111111','111111111111111112'),('${B}','222222222222222222','222222222222222223');
   INSERT INTO public.user_guilds(user_id,guild_id,discord_user_id,has_admin_permission) VALUES('${U}','${A}','111111111111111112',true),('${V}','${B}','222222222222222223',true);
   INSERT INTO public.server_backups(guild_id,payload) VALUES('${A}','A'),('${B}','B');
   INSERT INTO public.webhook_configs(guild_id,payload) VALUES('${A}','A'),('${B}','B');
   INSERT INTO public.raid_protection_settings(guild_id,payload) VALUES('${A}','A'),('${B}','B');
  `);
    await db.exec(
      await migration("20261110194422_bot_protect_sensitive_tables.sql"),
    );
    await t.test(
      "anonymous backup access and log forgery are denied",
      async () => {
        await assert.rejects(
          as(db, "anon", null, "SELECT * FROM public.server_backups"),
          /permission denied/,
        );
        await assert.rejects(
          as(
            db,
            "anon",
            null,
            `INSERT INTO public.bot_console_logs(guild_id,payload) VALUES('${A}','forged')`,
          ),
          /permission denied/,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              `UPDATE public.webhook_configs SET payload='changed' WHERE guild_id='${B}' RETURNING *`,
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          as(
            db,
            "authenticated",
            U,
            `INSERT INTO public.raid_protection_settings(guild_id,payload) VALUES('${B}','foreign')`,
          ),
          /row-level security/,
        );
      },
    );
    await db.exec(
      await migration("20261110193953_bot_verified_guild_access.sql"),
    );
    await t.test(
      "unverified and expired claims cannot authorize an existing logged-in user",
      async () => {
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await as(
              db,
              "service_role",
              null,
              `SELECT has_admin_permission FROM public.verified_user_guilds WHERE user_id='${U}'`,
            )
          ).rows.length,
          0,
        );
        await db.exec(
          `UPDATE public.user_guilds SET admin_verified_until=now()+interval '2 minutes' WHERE user_id='${U}'`,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await as(
              db,
              "service_role",
              null,
              `SELECT has_admin_permission FROM public.verified_user_guilds WHERE user_id='${U}'`,
            )
          ).rows[0].has_admin_permission,
          true,
        );
        await db.exec(
          `UPDATE public.user_guilds SET admin_verified_until=now()-interval '1 second' WHERE user_id='${U}'`,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await as(
              db,
              "service_role",
              null,
              `SELECT has_admin_permission FROM public.verified_user_guilds WHERE user_id='${U}'`,
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "browser cannot renew claims, change Discord identity or promote a demo into a real guild",
      async () => {
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              `UPDATE public.user_guilds SET admin_verified_until=now()+interval '1 year' RETURNING *`,
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          as(
            db,
            "authenticated",
            U,
            `UPDATE public.guilds SET guild_id='333333333333333333' WHERE id='${A}'`,
          ),
          /permission denied/,
        );
        await db.exec(
          `UPDATE public.guilds SET guild_id='demo_fixture',owner_id='${U}' WHERE id='${A}';UPDATE public.user_guilds SET is_demo_access=true WHERE user_id='${U}'`,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          1,
        );
      },
    );
    await t.test(
      "system logs remain private to staff and backend writes still work",
      async () => {
        await as(
          db,
          "service_role",
          null,
          "INSERT INTO public.bot_console_logs(guild_id,payload) VALUES(NULL,'system')",
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.bot_console_logs",
            )
          ).rows.length,
          0,
        );
        await db.exec("SELECT set_config('test.staff','true',false)");
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.bot_console_logs",
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await as(
              db,
              "authenticated",
              U,
              "SELECT * FROM public.server_backups",
            )
          ).rows.length,
          2,
        );
      },
    );
  } finally {
    await db.close();
  }
});
