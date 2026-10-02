#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${GUILDOS_REPO_URL:-https://github.com/Morfar22/guild-manage-suite.git}"
BRANCH="${GUILDOS_BRANCH:-main}"
BOT_DIR="${GUILDOS_BOT_DIR:-/bot}"
PM2_APP="${GUILDOS_PM2_APP:-discord-bot}"
DEPLOY_COMMANDS=false

if [[ "${1:-}" == "--deploy-commands" ]]; then
  DEPLOY_COMMANDS=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: bash update-from-github.sh [--deploy-commands]"
  exit 2
fi

for command in git rsync npm node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: Required command '$command' is not installed."
    exit 1
  fi
done

if [[ ! -d "$BOT_DIR" ]]; then
  echo "ERROR: Bot directory does not exist: $BOT_DIR"
  exit 1
fi

if [[ ! -f "$BOT_DIR/.env" ]]; then
  echo "ERROR: $BOT_DIR/.env is missing. Refusing to deploy without production environment."
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/guildos-update.XXXXXX)"
BACKUP_DIR="$BOT_DIR/.deploy-backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"
cp "$BOT_DIR/.env" "$BACKUP_DIR/env-$STAMP"

echo "==> Fetching GuildOS $BRANCH"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP_DIR/repo"

echo "==> Syncing bot files while preserving .env, node_modules and local logs"
rsync -a --delete \
  --exclude='.env' \
  --exclude='.deploy-backups/' \
  --exclude='node_modules/' \
  --exclude='logs/' \
  "$TMP_DIR/repo/bot/" "$BOT_DIR/"

cd "$BOT_DIR"

echo "==> Installing locked production dependencies"
npm ci --omit=dev

echo "==> Verifying locked Discord.js installation"
node -e "const d=require('discord.js'); if(!d.Client) throw new Error('discord.js Client export missing'); console.log('discord.js', d.version || '(version unavailable)', 'OK')"
test -f node_modules/discord.js/src/structures/ThreadChannel.js || {
  echo "ERROR: discord.js installation is incomplete (ThreadChannel.js missing)."
  echo "       Do not run npm audit fix directly in production. Re-run this updater to restore the lockfile state."
  exit 1
}

echo "==> Syntax checking critical runtime files"
for file in \
  bot.js \
  customBotManager.js \
  deployCommands.js \
  commandRouting.js \
  commandSync.js \
  inviteTracker.js \
  handlers/twitchHandler.js \
  handlers/pollHandler.js
do
  node --check "$file"
done

if [[ "$DEPLOY_COMMANDS" == "true" ]]; then
  echo "==> Syncing Discord slash commands"
  node deployCommands.js
fi

if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  echo "==> Restarting $PM2_APP"
  pm2 restart "$PM2_APP" --update-env
  pm2 save >/dev/null
else
  echo "==> PM2 app '$PM2_APP' was not found. Code is updated but no process was restarted."
fi

echo "==> GuildOS bot update completed successfully"
echo "    .env backup: $BACKUP_DIR/env-$STAMP"
