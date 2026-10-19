// Executes the audit round 2 RLS migrations against a real (in-process)
// PostgreSQL and asserts cross-tenant isolation.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const mig = (name) =>
  fs.readFileSync(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );

const admin = "00000000-0000-0000-0000-00000000000a";
const member = "00000000-0000-0000-0000-00000000000b";
const A = "10000000-0000-0000-0000-00000000000a";
const B = "10000000-0000-0000-0000-00000000000b";

async function as(db, role, sub, fn) {
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub','${sub ?? ""}',false); SET ROLE ${role};`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE;");
  }
}

test("round 2 migrations isolate guild data at the database level", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TYPE public.app_role AS ENUM ('admin','staff','user');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT coalesce(current_setting('test.global_admin', true), 'false') = 'true' $$;
      CREATE FUNCTION public.has_admin_or_staff_role(uuid) RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT coalesce(current_setting('test.global_admin', true), 'false') = 'true' $$;
      CREATE TABLE public.guilds(id uuid PRIMARY KEY, guild_id text);
      CREATE TABLE public.user_guilds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, guild_id uuid, has_admin_permission boolean DEFAULT false);
      CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, role public.app_role);
      CREATE TABLE public.raid_protection_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL, enabled boolean DEFAULT false);
      CREATE TABLE public.tebex_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id text NOT NULL);
      CREATE TABLE public.music_quiz_songs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid);
      CREATE TABLE public.global_ban_appeals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reason text);
      CREATE TABLE public.ticket_internal_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL, note text);
      ALTER TABLE public.user_guilds ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.raid_protection_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.tebex_purchases ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.music_quiz_songs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.global_ban_appeals ENABLE ROW LEVEL SECURITY;
      -- legacy permissive policies as found in the migration history
      CREATE POLICY "Users can view their own guild links" ON public.user_guilds FOR SELECT USING (user_id = auth.uid());
      CREATE POLICY "Users can insert their own guild links" ON public.user_guilds FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "Admins can manage all user_guilds" ON public.user_guilds FOR ALL USING (public.has_role(auth.uid(), 'admin'));
      CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
      CREATE POLICY "raid_protection_all" ON public.raid_protection_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
      CREATE POLICY "Service role full access on tebex_purchases" ON public.tebex_purchases FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Anyone authed can view songs" ON public.music_quiz_songs FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Authenticated users can view appeals" ON public.global_ban_appeals FOR SELECT USING (auth.uid() IS NOT NULL);
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
      INSERT INTO public.guilds VALUES ('${A}','1'),('${B}','2');
      INSERT INTO public.user_guilds(user_id,guild_id,has_admin_permission) VALUES ('${admin}','${A}',true),('${member}','${A}',false);
      INSERT INTO public.raid_protection_settings(guild_id) VALUES ('${A}'),('${B}');
      INSERT INTO public.tebex_purchases(guild_id) VALUES ('${A}'),('${B}');
      INSERT INTO public.music_quiz_songs(guild_id) VALUES (NULL),('${A}'),('${B}');
      INSERT INTO public.global_ban_appeals(reason) VALUES ('x');
      INSERT INTO public.ticket_internal_notes(guild_id,note) VALUES ('${A}','a'),('${B}','b');
    `);
    await db.exec(
      mig("20261019200000_audit_enable_rls_platform_v3_tables.sql"),
    );
    await db.exec(mig("20261019201000_audit_tenant_isolation_policies.sql"));
    await db.exec(
      mig("20261019202000_audit_block_self_granted_guild_admin.sql"),
    );

    const count = async (sql, params) =>
      (await db.query(sql, params)).rows.length;

    await t.test(
      "guild admin sees and edits only their own guild",
      async () => {
        await as(db, "authenticated", admin, async () => {
          assert.equal(
            await count("SELECT * FROM public.raid_protection_settings"),
            1,
          );
          assert.equal(
            await count(
              "UPDATE public.raid_protection_settings SET enabled=true WHERE guild_id=$1 RETURNING id",
              [A],
            ),
            1,
          );
          assert.equal(
            await count(
              "UPDATE public.raid_protection_settings SET enabled=true WHERE guild_id=$1 RETURNING id",
              [B],
            ),
            0,
          );
          await assert.rejects(
            db.query(
              "INSERT INTO public.raid_protection_settings(guild_id) VALUES ($1)",
              [B],
            ),
            /row-level security/,
          );
          assert.equal(
            await count("SELECT * FROM public.tebex_purchases"),
            1,
            "text guild_id match",
          );
          assert.equal(
            await count("SELECT * FROM public.ticket_internal_notes"),
            1,
            "v3 table isolated",
          );
          assert.equal(
            await count("SELECT * FROM public.music_quiz_songs"),
            2,
            "global + own guild songs",
          );
        });
      },
    );

    await t.test("non-admin members and other users see nothing", async () => {
      await as(db, "authenticated", member, async () => {
        assert.equal(
          await count("SELECT * FROM public.raid_protection_settings"),
          0,
        );
        assert.equal(
          await count("SELECT * FROM public.ticket_internal_notes"),
          0,
        );
        assert.equal(await count("SELECT * FROM public.global_ban_appeals"), 0);
        assert.equal(
          await count("SELECT * FROM public.music_quiz_songs"),
          1,
          "only the global pool",
        );
      });
    });

    await t.test(
      "users cannot self-grant guild admin or platform roles",
      async () => {
        await as(db, "authenticated", member, async () => {
          await assert.rejects(
            db.query(
              "INSERT INTO public.user_guilds(user_id,guild_id,has_admin_permission) VALUES ($1,$2,true)",
              [member, B],
            ),
            /row-level security/,
          );
          await assert.rejects(
            db.query(
              "INSERT INTO public.user_roles(user_id,role) VALUES ($1,'admin')",
              [member],
            ),
            /row-level security/,
          );
        });
      },
    );

    await t.test("anon has no table privileges", async () => {
      await as(db, "anon", null, async () => {
        await assert.rejects(
          db.query("SELECT * FROM public.raid_protection_settings"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("SELECT * FROM public.ticket_internal_notes"),
          /permission denied/,
        );
      });
    });

    await t.test(
      "platform admins and service role keep full access",
      async () => {
        await db.exec("SELECT set_config('test.global_admin','true',false);");
        await as(db, "authenticated", member, async () => {
          assert.equal(
            await count("SELECT * FROM public.raid_protection_settings"),
            2,
          );
          assert.equal(
            await count("SELECT * FROM public.global_ban_appeals"),
            1,
          );
        });
        await db.exec("SELECT set_config('test.global_admin','false',false);");
        await as(db, "service_role", null, async () => {
          assert.equal(
            await count("SELECT * FROM public.ticket_internal_notes"),
            2,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
