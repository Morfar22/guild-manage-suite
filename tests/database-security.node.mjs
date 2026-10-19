import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20261016093000_lock_down_guild_membership.sql",
    import.meta.url,
  ),
  "utf8",
);
const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const guild = "10000000-0000-0000-0000-000000000001";
const foreign = "10000000-0000-0000-0000-000000000002";
const demo = "10000000-0000-0000-0000-000000000003";

async function asRole(db, role, callback) {
  await db.exec(`SET ROLE ${role};`);
  try {
    return await callback();
  } finally {
    await db.exec("RESET ROLE;");
  }
}

test("PostgreSQL enforces guild membership and partner-statistics isolation", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TYPE public.app_role AS ENUM ('admin', 'user');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT coalesce(current_setting('test.global_admin', true), 'false') = 'true' $$;
      CREATE TABLE public.guilds(id uuid PRIMARY KEY, guild_id text NOT NULL);
      CREATE TABLE public.user_guilds(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
        guild_id uuid REFERENCES public.guilds(id), has_admin_permission boolean NOT NULL DEFAULT false,
        UNIQUE(user_id, guild_id)
      );
      CREATE TABLE public.twitch_partner_weekly_stats(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid REFERENCES public.guilds(id), streams_count int DEFAULT 0);
      ALTER TABLE public.user_guilds ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.twitch_partner_weekly_stats ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Users can view their own guild links" ON public.user_guilds FOR SELECT USING (user_id = auth.uid());
      CREATE POLICY "Users can insert their own guild links" ON public.user_guilds FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "Admins can manage all user_guilds" ON public.user_guilds FOR ALL USING (public.has_role(auth.uid(), 'admin'));
      CREATE POLICY "Allow anon read partner weekly stats" ON public.twitch_partner_weekly_stats FOR SELECT USING (true);
      CREATE POLICY "Allow anon insert partner weekly stats" ON public.twitch_partner_weekly_stats FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow anon update partner weekly stats" ON public.twitch_partner_weekly_stats FOR UPDATE USING (true);
      CREATE POLICY "Allow anon delete partner weekly stats" ON public.twitch_partner_weekly_stats FOR DELETE USING (true);
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
      INSERT INTO public.guilds VALUES ('${guild}', '111111111111111111'), ('${foreign}', '222222222222222222'), ('${demo}', 'demo_example');
      INSERT INTO public.user_guilds(user_id,guild_id,has_admin_permission) VALUES ('${user}','${guild}',true), ('${other}','${foreign}',true), ('${user}','${demo}',true);
      INSERT INTO public.twitch_partner_weekly_stats(guild_id) VALUES ('${guild}'), ('${foreign}');
      SELECT set_config('request.jwt.claim.sub','${user}',false);
    `);
    await db.exec(migration);

    await t.test(
      "unverified real-server grants are invalidated; demo grants survive",
      async () => {
        const { rows } = await db.query(
          "SELECT guild_id,has_admin_permission FROM public.user_guilds ORDER BY guild_id",
        );
        assert.equal(
          rows
            .filter((row) => row.guild_id !== demo)
            .every((row) => row.has_admin_permission === false),
          true,
        );
        assert.equal(
          rows.find((row) => row.guild_id === demo).has_admin_permission,
          true,
        );
      },
    );
    await t.test(
      "ordinary authenticated users cannot self-grant server administrator access",
      async () => {
        await asRole(db, "authenticated", async () => {
          await assert.rejects(
            db.query(
              "INSERT INTO public.user_guilds(user_id,guild_id,has_admin_permission) VALUES ($1,$2,true)",
              [user, foreign],
            ),
            /row-level security/,
          );
        });
      },
    );
    await t.test(
      "service role can restore verified membership and global admins can manage grants",
      async () => {
        await asRole(db, "service_role", async () => {
          await db.query(
            "UPDATE public.user_guilds SET has_admin_permission=true WHERE user_id=$1 AND guild_id=$2",
            [user, guild],
          );
        });
        await db.exec("SELECT set_config('test.global_admin','true',false);");
        await asRole(db, "authenticated", async () => {
          await db.query(
            "INSERT INTO public.user_guilds(user_id,guild_id,has_admin_permission) VALUES ($1,$2,false)",
            [user, foreign],
          );
        });
        await db.exec("SELECT set_config('test.global_admin','false',false);");
      },
    );
    await t.test(
      "anonymous callers cannot read, insert, change or delete partner statistics",
      async () => {
        await asRole(db, "anon", async () => {
          assert.equal(
            (await db.query("SELECT * FROM public.twitch_partner_weekly_stats"))
              .rows.length,
            0,
          );
          await assert.rejects(
            db.query(
              "INSERT INTO public.twitch_partner_weekly_stats(guild_id) VALUES ($1)",
              [guild],
            ),
            /row-level security/,
          );
          assert.equal(
            (
              await db.query(
                "UPDATE public.twitch_partner_weekly_stats SET streams_count=99 RETURNING id",
              )
            ).rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                "DELETE FROM public.twitch_partner_weekly_stats RETURNING id",
              )
            ).rows.length,
            0,
          );
        });
      },
    );
    await t.test(
      "guild admins see only their guild; statistics stay bot-managed",
      async () => {
        await asRole(db, "authenticated", async () => {
          const { rows } = await db.query(
            "SELECT guild_id FROM public.twitch_partner_weekly_stats",
          );
          assert.deepEqual(
            rows.map((row) => row.guild_id),
            [guild],
          );
          await assert.rejects(
            db.query(
              "INSERT INTO public.twitch_partner_weekly_stats(guild_id) VALUES ($1)",
              [guild],
            ),
            /row-level security/,
          );
        });
        await asRole(db, "service_role", async () => {
          await db.query(
            "UPDATE public.twitch_partner_weekly_stats SET streams_count=1 WHERE guild_id=$1",
            [guild],
          );
          assert.equal(
            (await db.query("SELECT * FROM public.twitch_partner_weekly_stats"))
              .rows.length,
            2,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
