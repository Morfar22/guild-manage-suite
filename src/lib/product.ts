export const PUBLIC_BOT_CLIENT_ID =
  import.meta.env['VITE_DISCORD_BOT_CLIENT_ID'] || '1555371176224628787';

export const BOT_PERMISSION_MASK = '564593851624694';

export function buildBotInviteUrl(clientId = PUBLIC_BOT_CLIENT_ID) {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSION_MASK}&scope=bot%20applications.commands`;
}

export const PUBLIC_BOT_INVITE_URL = buildBotInviteUrl();

export const PRODUCT_COUNTS = {
  modules: 49,
  logicalCommands: 151,
  commandRoots: 13,
} as const;
