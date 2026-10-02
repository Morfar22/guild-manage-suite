#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAVALINK_DIR="$ROOT_DIR/lavalink"
JAR="$LAVALINK_DIR/Lavalink.jar"

mkdir -p "$LAVALINK_DIR"

if ! command -v java >/dev/null 2>&1; then
  echo "[Lavalink] ❌ Java er ikke installeret."
  echo "[Lavalink] Installer Java 17+ først."
  exit 1
fi

JAVA_VERSION="$(java -version 2>&1 | head -n 1)"
echo "[Lavalink] Java: $JAVA_VERSION"

echo "[Lavalink] Henter seneste Lavalink.jar..."
curl -fL   https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar   -o "$JAR"

chmod 0644 "$JAR"
chmod +x "$ROOT_DIR/scripts/start-lavalink.sh"

echo "[Lavalink] ✅ Installeret: $JAR"
echo "[Lavalink] Start med: bash scripts/start-lavalink.sh"
