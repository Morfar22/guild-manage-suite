# Deploy Agent

Lille HTTP-server der kører på VPS'en ved siden af bot'en. Lovable's `bot-deploy`
edge function kalder den med Bearer token og udfører `git pull`, `pm2 restart`, osv.

## Install på VPS

```bash
# 1. Upload mappen (eller git clone hvis den ligger i samme repo)
scp -r bot/deploy-agent user@vps:/home/deploy-agent

# 2. Konfigurer
cd /home/deploy-agent
cp .env.example .env
nano .env   # udfyld DEPLOY_AGENT_TOKEN (samme som i Lovable!) + REPO_DIR

# 3. Install + start
npm install
pm2 start server.js --name deploy-agent
pm2 save
```

## Test

```bash
curl http://127.0.0.1:9000/health
# → {"ok":true,...}

curl -H "Authorization: Bearer DIT_TOKEN" http://127.0.0.1:9000/bot/status
```
