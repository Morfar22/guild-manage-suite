#!/bin/bash
# ==========================================
# Discord Bot - Setup Script
# ==========================================
# Organiserer handler-filer i den korrekte mappestruktur
# og installerer dependencies.
#
# Kør: bash setup.sh
# ==========================================

set -e

echo "🔧 Discord Bot Setup"
echo "===================="

# Opret mapper
echo "📁 Opretter mapper..."
mkdir -p handlers
mkdir -p logs

# Liste over handler-filer der skal flyttes til handlers/
HANDLERS=(
  "afkHandler.js"
  "aiChatHandler.js"
  "analyticsHandler.js"
  "applicationHandler.js"
  "autoReportHandler.js"
  "autoResponderHandler.js"
  "consoleLogger.js"
  "customCommandHandler.js"
  "globalBanHandler.js"
  "heartbeatHandler.js"
  "jtcHandler.js"
  "logHandler.js"
  "modmailHandler.js"
  "pollHandler.js"
  "reactionRoleHandler.js"
  "reminderHandler.js"
  "scheduledActionHandler.js"
  "schedulerHandler.js"
  "starboardHandler.js"
  "statsHandler.js"
  "suggestionHandler.js"
  "tebexHandler.js"
  "ticketHandler.js"
  "tiktokHandler.js"
  "twitchHandler.js"
  "verificationHandler.js"
  "warningHandler.js"
  "welcomeHandler.js"
  "xpHandler.js"
)

echo "📦 Flytter handler-filer til handlers/..."
for handler in "${HANDLERS[@]}"; do
  if [ -f "$handler" ] && [ ! -f "handlers/$handler" ]; then
    cp "$handler" "handlers/$handler"
    echo "  ✅ $handler → handlers/$handler"
  elif [ -f "handlers/$handler" ]; then
    echo "  ⏭️  handlers/$handler eksisterer allerede"
  else
    echo "  ⚠️  $handler ikke fundet"
  fi
done

# Kopiér .env.example til .env hvis den ikke eksisterer
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo ""
    echo "📝 .env fil oprettet fra .env.example"
    echo "   ⚠️  HUSK at udfylde værdierne i .env!"
  fi
fi

# Installer dependencies
echo ""
echo "📦 Installerer dependencies..."
npm install

echo ""
echo "✅ Setup færdig!"
echo ""
echo "==========================================
NÆSTE TRIN:
==========================================
1. Udfyld .env filen med dine credentials
2. Deploy slash commands:  node deployCommands.js
3. Start botten:           node bot.js
   Eller med PM2:          pm2 start ecosystem.config.js
==========================================
"
