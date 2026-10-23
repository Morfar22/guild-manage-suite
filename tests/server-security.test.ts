import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseStub } from "./mocks/supabase";
import {
  apiError,
  requireUser,
  requireGuildAdmin,
  requireBotSecret,
  requireGuildChannel,
} from "../src/lib/server/api-auth";
import {
  createOAuthState,
  validOAuthState,
  clearOAuthStateCookie,
  findAuthUserByEmail,
} from "../src/lib/server/discord-oauth-security";
import {
  encryptBotToken,
  decryptBotToken,
} from "../src/lib/server/bot-token-crypto";

describe("API authorization boundaries", () => {
  const client = (db: ReturnType<typeof createSupabaseStub>) =>
    db as unknown as SupabaseClient;
  it("requires a bearer token and authenticated identity", async () => {
    const db = createSupabaseStub();
    for (const authorization of ["", "Basic abc", "Bearer ", "Bearer invalid"])
      await expect(
        requireUser(
          new Request("https://app.invalid", { headers: { authorization } }),
          client(db),
        ),
      ).rejects.toMatchObject({ status: 401 });
    expect(
      await requireUser(
        new Request("https://app.invalid", {
          headers: { authorization: "Bearer valid" },
        }),
        client(db),
      ),
    ).toEqual({ id: "user-a" });
  });
  it("requires an administrator grant scoped to both user and guild", async () => {
    let admin = false;
    let exists = true;
    const db = createSupabaseStub({
      result: (query) => ({
        data:
          query.table === "user_guilds"
            ? { has_admin_permission: admin }
            : exists
              ? { id: "guild", guild_id: "discord" }
              : null,
        error: null,
      }),
    });
    await expect(
      requireGuildAdmin(client(db), "user", ""),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      requireGuildAdmin(client(db), "user", "guild"),
    ).rejects.toMatchObject({ status: 403 });
    admin = true;
    expect(await requireGuildAdmin(client(db), "user", "guild")).toEqual({
      id: "guild",
      guild_id: "discord",
    });
    expect(db.queries[0].filters).toEqual([
      ["user_id", "user"],
      ["guild_id", "guild"],
    ]);
    exists = false;
    await expect(
      requireGuildAdmin(client(db), "user", "guild"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("fails closed on missing bot secrets", () => {
    vi.stubEnv("BOT_SECRET_KEY", "expected-secret");
    expect(() =>
      requireBotSecret(new Request("https://app.invalid")),
    ).toThrow();
    expect(() =>
      requireBotSecret(
        new Request("https://app.invalid", {
          headers: { "x-bot-secret": "expected-secret" },
        }),
      ),
    ).not.toThrow();
    expect(apiError(403, "Forbidden").headers.get("Cache-Control")).toBe(
      "no-store",
    );
  });
  it("verifies channel ownership and propagates Discord failure classes", async () => {
    await expect(
      requireGuildChannel("token", "guild", "invalid"),
    ).rejects.toMatchObject({ status: 400 });
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    for (const [remote, expected] of [
      [404, 404],
      [500, 502],
    ]) {
      transport.mockResolvedValueOnce(new Response("", { status: remote }));
      await expect(
        requireGuildChannel("token", "guild", "123456789012345678"),
      ).rejects.toMatchObject({ status: expected });
    }
    transport.mockResolvedValueOnce(Response.json({ guild_id: "foreign" }));
    await expect(
      requireGuildChannel("token", "guild", "123456789012345678"),
    ).rejects.toMatchObject({ status: 403 });
    transport.mockResolvedValueOnce(Response.json({ guild_id: "guild" }));
    await expect(
      requireGuildChannel("token", "guild", "123456789012345678"),
    ).resolves.toBeUndefined();
  });
});

describe("OAuth and encrypted credentials", () => {
  it("binds a random state to a secure, expiring browser cookie", () => {
    const first = createOAuthState();
    expect(first.state).not.toBe(createOAuthState().state);
    expect(first.cookie).toContain(
      "HttpOnly; Secure; SameSite=Lax; Max-Age=600",
    );
    const request = new Request("https://app.invalid", {
      headers: { cookie: `other=x; ${first.cookie.split(";")[0]}` },
    });
    expect(validOAuthState(request, first.state)).toBe(true);
    for (const invalid of [null, "invalid", "a".repeat(64)])
      expect(validOAuthState(request, invalid)).toBe(false);
    expect(
      validOAuthState(new Request("https://app.invalid"), first.state),
    ).toBe(false);
    expect(clearOAuthStateCookie()).toContain("Max-Age=0");
  });
  it("paginates account lookup, normalizes email, and surfaces failed lookups", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          users: Array.from({ length: 1000 }, () => ({
            email: "other@example.test",
          })),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [{ id: "found", email: "User@example.test" }] },
        error: null,
      });
    const db = { auth: { admin: { listUsers } } } as unknown as SupabaseClient;
    expect(await findAuthUserByEmail(db, "USER@example.test")).toMatchObject({
      id: "found",
    });
    expect(listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 1000 });
    listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
    expect(await findAuthUserByEmail(db, "absent")).toBeNull();
    listUsers.mockResolvedValueOnce({ data: null, error: Error("offline") });
    await expect(findAuthUserByEmail(db, "any")).rejects.toThrow("offline");
    listUsers.mockResolvedValueOnce({ data: null, error: null });
    await expect(findAuthUserByEmail(db, "any")).rejects.toThrow(
      "Unable to look up account",
    );
  });
  it("authenticates ciphertext and rejects malformed versions and unsafe keys", () => {
    const encrypted = encryptBotToken("credential", "secret");
    expect(decryptBotToken(encrypted, "secret")).toBe("credential");
    expect(encryptBotToken("credential", "secret")).not.toBe(encrypted);
    expect(() => decryptBotToken(encrypted, "other")).toThrow();
    for (const malformed of ["v1.x", "v1.a.b.c", "v2.unknown"])
      expect(() => decryptBotToken(malformed, "secret")).toThrow();
    for (const key of ["", "default-encryption-key"])
      expect(() => encryptBotToken("token", key)).toThrow();
    const legacy = btoa(
      Array.from("credential", (char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ "secret".charCodeAt(i % 6)),
      ).join(""),
    );
    expect(decryptBotToken(legacy, "secret")).toBe("credential");
  });
});
