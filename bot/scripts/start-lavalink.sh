#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

LAVALINK_PORT="${LAVALINK_PORT:-40191}"
LAVALINK_PASSWORD="${LAVALINK_PASSWORD:-youshallnotpass}"
LAVALINK_JAR="${LAVALINK_JAR:-$ROOT_DIR/lavalink/Lavalink.jar}"
LAVALINK_CONFIG="${LAVALINK_CONFIG:-$ROOT_DIR/lavalink/application.yml}"

export LAVALINK_PORT
export LAVALINK_PASSWORD
export YOUTUBE_OAUTH_ENABLED="${YOUTUBE_OAUTH_ENABLED:-false}"
export YOUTUBE_REFRESH_TOKEN="${YOUTUBE_REFRESH_TOKEN:-}"

# Lavalink also supports config via environment variables. Export the important
# server values explicitly so a stale host-level SERVER_PORT cannot win.
export SERVER_PORT="$LAVALINK_PORT"
export SERVER_ADDRESS="0.0.0.0"
export LAVALINK_SERVER_PASSWORD="$LAVALINK_PASSWORD"

if [ ! -f "$LAVALINK_JAR" ]; then
  echo "[Lavalink] ❌ Jar mangler: $LAVALINK_JAR"
  echo "[Lavalink] Kør: bash scripts/install-lavalink.sh"
  exit 1
fi

if [ ! -f "$LAVALINK_CONFIG" ]; then
  echo "[Lavalink] ❌ Config mangler: $LAVALINK_CONFIG"
  exit 1
fi

echo "[Lavalink] Starter på 0.0.0.0:$LAVALINK_PORT"
echo "[Lavalink] Config: $LAVALINK_CONFIG"
echo "[Lavalink] YouTube OAuth: $YOUTUBE_OAUTH_ENABLED"

exec java -jar "$LAVALINK_JAR" --spring.config.location="file:$LAVALINK_CONFIG"
