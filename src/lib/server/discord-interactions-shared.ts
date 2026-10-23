/** Runtime-neutral helpers shared by the dashboard and Supabase Edge Function. */
export interface GiveawayMessage {
  id: string;
  entries?: unknown;
  winners?: unknown;
  ended?: boolean | null;
  ends_at: string;
  winners_count: number;
  required_role_id?: string | null;
  prize: string;
  description?: string | null;
}

/** Verify the exact signed bytes before parsing an interaction body. */
export async function verifyDiscordSignature(
  request: Request,
  body: string,
  publicKey: string | undefined,
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (
    !signature ||
    !timestamp ||
    !publicKey ||
    !/^[0-9a-f]{128}$/i.test(signature) ||
    !/^[0-9a-f]{64}$/i.test(publicKey)
  )
    return false;
  const fromHex = (hex: string) =>
    Uint8Array.from(hex.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      fromHex(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      fromHex(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

export function getGiveawayEntries(entries: unknown): string[] {
  return Array.isArray(entries)
    ? entries.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function getGiveawayWinners(winners: unknown): string[] {
  return Array.isArray(winners)
    ? winners.filter((winner): winner is string => typeof winner === "string")
    : [];
}

export function buildGiveawayMessagePayload(giveaway: GiveawayMessage) {
  const entries = getGiveawayEntries(giveaway.entries);
  const winners = getGiveawayWinners(giveaway.winners);
  const hasEnded = giveaway.ended || new Date(giveaway.ends_at) <= new Date();
  const endsAtUnix = Math.floor(new Date(giveaway.ends_at).getTime() / 1000);
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: hasEnded ? "⏱️ Sluttede" : "⏱️ Slutter",
      value: `<t:${endsAtUnix}:${hasEnded ? "f" : "R"}>`,
      inline: true,
    },
    {
      name: "🏆 Vindere",
      value: String(giveaway.winners_count),
      inline: true,
    },
    {
      name: "🎫 Deltagere",
      value: String(entries.length),
      inline: true,
    },
  ];

  if (giveaway.required_role_id) {
    fields.push({
      name: "🔒 Krævet rolle",
      value: `<@&${giveaway.required_role_id}>`,
      inline: false,
    });
  }

  if (hasEnded) {
    fields.push({
      name: "🎊 Resultat",
      value:
        winners.length > 0
          ? winners.map((winnerId) => `<@${winnerId}>`).join(", ")
          : "Ingen gyldige deltagere.",
      inline: false,
    });
  }

  return {
    content: hasEnded
      ? "🎉 Giveawayen er afsluttet."
      : "Klik på knappen nedenfor for at deltage!",
    embeds: [
      {
        title: hasEnded ? "🎉 Giveaway afsluttet" : "🎉 Giveaway!",
        description: `**${giveaway.prize}**${giveaway.description ? `\n\n${giveaway.description}` : ""}`,
        color: hasEnded ? 0x57f287 : 0x5865f2,
        fields,
        footer: {
          text: `Giveaway ID: ${giveaway.id}`,
        },
        timestamp: new Date(giveaway.ends_at).toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: hasEnded ? 2 : 3,
            custom_id: `giveaway_enter_${giveaway.id}`,
            label: hasEnded
              ? "Giveaway afsluttet"
              : `Deltag (${entries.length})`,
            emoji: { name: "🎉" },
            disabled: hasEnded,
          },
        ],
      },
    ],
  };
}
