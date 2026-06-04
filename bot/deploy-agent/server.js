// Deploy Agent – lille HTTP-server der kører på VPS'en og udfører
// git pull / pm2 restart osv. på kommando fra Lovable admin panelet.
//
// Sikkerhed: Alle /bot/* endpoints kræver Bearer token der matcher
// DEPLOY_AGENT_TOKEN. Token skal være IDENTISK med den i Lovable secrets.

require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const {
  DEPLOY_AGENT_TOKEN,
  PORT = 9000,
  REPO_DIR,
  PM2_NAME = 'discord-bot',
} = process.env;

if (!DEPLOY_AGENT_TOKEN) {
  console.error('FATAL: DEPLOY_AGENT_TOKEN mangler i .env');
  process.exit(1);
}
if (!REPO_DIR || !fs.existsSync(REPO_DIR)) {
  console.error(`FATAL: REPO_DIR "${REPO_DIR}" findes ikke`);
  process.exit(1);
}

const app = express();
app.use(express.json());

// Health check (uden auth) — bruges af nginx/uptime checks
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Auth middleware for alt under /bot
app.use('/bot', (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token !== DEPLOY_AGENT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Helper: kør shell-kommando i REPO_DIR og returner stdout/stderr
function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: REPO_DIR, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        code: err?.code ?? 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
      });
    });
  });
}

// GET /bot/status – pm2 status + git info
app.get('/bot/status', async (_req, res) => {
  const [pm2, branch, commit] = await Promise.all([
    run(`pm2 jlist`),
    run(`git rev-parse --abbrev-ref HEAD`),
    run(`git log -1 --pretty=format:"%h %s (%cr)"`),
  ]);
  let online = false;
  try {
    const list = JSON.parse(pm2.stdout || '[]');
    const proc = list.find((p) => p.name === PM2_NAME);
    online = proc?.pm2_env?.status === 'online';
  } catch (_) {}
  res.json({
    online,
    pm2_name: PM2_NAME,
    branch: branch.stdout.trim(),
    commit: commit.stdout.trim(),
  });
});

// GET /bot/logs?lines=200
app.get('/bot/logs', async (req, res) => {
  const lines = Math.min(parseInt(req.query.lines, 10) || 100, 1000);
  const out = await run(`pm2 logs ${PM2_NAME} --lines ${lines} --nostream --raw`);
  res.json(out);
});

async function startBotProcess() {
  if (fs.existsSync(path.join(REPO_DIR, 'ecosystem.config.js'))) {
    return run(`pm2 start ecosystem.config.js --only ${PM2_NAME} --update-env`);
  }
  return run(`pm2 start bot.js --name ${PM2_NAME} --update-env`);
}

async function restartBotProcess() {
  const restart = await run(`pm2 restart ${PM2_NAME} --update-env`);
  if (restart.ok) return restart;

  const missingProcess = /not found|process.*not found|doesn't exist|unknown process/i.test(
    `${restart.stdout}\n${restart.stderr}`,
  );
  if (!missingProcess) return restart;

  const start = await startBotProcess();
  return {
    ok: start.ok,
    code: start.code,
    stdout: [restart.stdout, start.stdout].filter(Boolean).join('\n--- fallback start ---\n'),
    stderr: [restart.stderr, start.stderr].filter(Boolean).join('\n--- fallback start ---\n'),
    fallback: 'start',
  };
}

app.post('/bot/pull',    async (_req, res) => res.json(await run(`git pull`)));
app.post('/bot/restart', async (_req, res) => res.json(await restartBotProcess()));
app.post('/bot/start',   async (_req, res) => res.json(await startBotProcess()));
app.post('/bot/stop',    async (_req, res) => res.json(await run(`pm2 stop ${PM2_NAME}`)));

// POST /bot/deploy – pull + install + restart i ét hug
app.post('/bot/deploy', async (_req, res) => {
  const pull = await run(`git pull`);
  if (!pull.ok) return res.json({ step: 'pull', ...pull });
  const install = await run(`npm install --omit=dev`);
  if (!install.ok) return res.json({ step: 'install', ...install });
  const restart = await restartBotProcess();
  res.json({ step: 'restart', pull, install, restart });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[deploy-agent] listening on 127.0.0.1:${PORT}`);
  console.log(`[deploy-agent] REPO_DIR=${REPO_DIR}  PM2_NAME=${PM2_NAME}`);
});
