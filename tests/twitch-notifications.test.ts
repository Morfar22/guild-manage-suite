import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createLiveEmbed,
  createOfflineEmbed,
  describeProgress,
  formatMessage,
  getWeekStartDate,
  type TwitchStream,
  type TwitchUser,
} from "../src/lib/server/twitch-notifications-shared";

const user: TwitchUser = {
  id: "123",
  login: "streamer",
  display_name: "Streamer",
  profile_image_url: "https://example.invalid/avatar.png",
};
const stream: TwitchStream = {
  id: "stream-1",
  user_id: user.id,
  user_login: user.login,
  user_name: user.display_name,
  game_id: "456",
  game_name: "A game",
  type: "live",
  title: "Tonight's stream",
  viewer_count: 123,
  started_at: "2026-10-24T08:00:00Z",
  language: "da",
  thumbnail_url: "https://example.invalid/{width}x{height}.jpg",
  is_mature: false,
};

afterEach(() => vi.useRealTimers());

describe("shared Twitch notification rendering", () => {
  test("weeks start on Monday in UTC, including Sunday and year boundaries", () => {
    expect(getWeekStartDate(new Date("2026-10-25T23:59:59Z"))).toBe(
      "2026-10-19",
    );
    expect(getWeekStartDate(new Date("2026-10-26T00:00:00Z"))).toBe(
      "2026-10-26",
    );
    expect(getWeekStartDate(new Date("2027-01-01T12:00:00Z"))).toBe(
      "2026-12-28",
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    expect(getWeekStartDate()).toBe("2026-10-19");
  });

  test("quota progress requires every configured goal and defaults missing counters", () => {
    expect(describeProgress({})).toEqual({
      progress: "0 streams",
      goal: "0 streams",
      met: true,
    });
    expect(
      describeProgress({
        quota_type: "streams",
        current_week_streams: 1,
        quota_streams_per_week: 2,
      }),
    ).toEqual({ progress: "1 streams", goal: "2 streams", met: false });
    expect(
      describeProgress({
        quota_type: "hours",
        current_week_minutes: 120,
        quota_hours_per_week: 2,
      }),
    ).toEqual({ progress: "2.0t", goal: "2t", met: true });
    expect(describeProgress({ quota_type: "hours" })).toEqual({
      progress: "0.0t",
      goal: "0t",
      met: true,
    });
    expect(
      describeProgress({
        quota_type: "both",
        current_week_streams: 2,
        quota_streams_per_week: 2,
        current_week_minutes: 59,
        quota_hours_per_week: 1,
      }).met,
    ).toBe(false);
    expect(
      describeProgress({
        quota_type: "both",
        current_week_streams: 1,
        quota_streams_per_week: 2,
        current_week_minutes: 120,
        quota_hours_per_week: 1,
      }).met,
    ).toBe(false);
    expect(
      describeProgress({
        quota_type: "both",
        current_week_streams: 2,
        quota_streams_per_week: 2,
        current_week_minutes: 120,
        quota_hours_per_week: 1,
      }).met,
    ).toBe(true);
    expect(describeProgress({ quota_type: "both" })).toEqual({
      progress: "0 streams / 0.0t",
      goal: "0 streams / 0t",
      met: true,
    });
  });

  test("templates replace repeated known placeholders and preserve unknown ones", () => {
    expect(
      formatMessage("{streamer}: {title}, {streamer} {unknown}", {
        streamer: "Alice",
        title: "Live",
      }),
    ).toBe("Alice: Live, Alice {unknown}");
    expect(formatMessage("unchanged", {})).toBe("unchanged");
  });

  test("live embeds render configured content, thumbnail dimensions and uptime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T09:30:00Z"));
    expect(
      createLiveEmbed(stream, user, { live_embed_color: "#123456" }, "Live"),
    ).toMatchObject({
      title: "🔴 LIVE: Tonight's stream",
      url: "https://twitch.tv/streamer",
      color: 0x123456,
      fields: [
        { name: "🎮 Spil", value: "A game" },
        { name: "👀 Seere", value: "123" },
        { name: "⏱️ Uptime", value: "1t 30m" },
      ],
      image: { url: `https://example.invalid/1280x720.jpg?t=${Date.now()}` },
      footer: { text: "Twitch • DA" },
      thumbnail: { url: user.profile_image_url },
    });
  });

  test("live display settings omit game, viewers and thumbnail while keeping uptime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T08:05:00Z"));
    const embed = createLiveEmbed(
      { ...stream, language: "" },
      user,
      { show_game: false, show_viewers: false, show_thumbnail: false },
      "Live",
    );
    expect(embed).toMatchObject({
      color: 0x9146ff,
      fields: [{ name: "⏱️ Uptime", value: "5m" }],
      footer: { text: "Twitch • DA" },
    });
    expect(embed).not.toHaveProperty("image");
    const noGame = createLiveEmbed(
      { ...stream, game_name: "" },
      user,
      {},
      "Live",
    );
    expect(noGame.fields).toHaveLength(2);
  });

  test("offline embeds use supplied message and configured or default colour", () => {
    expect(createOfflineEmbed(user, {}, "Stream ended")).toMatchObject({
      description: "Stream ended",
      color: 0x6441a5,
      thumbnail: { url: user.profile_image_url },
    });
    expect(
      createOfflineEmbed(user, { offline_embed_color: "#112233" }, "Bye"),
    ).toMatchObject({ description: "Bye", color: 0x112233 });
  });
});
