require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const { DEPLOY_AGENT_TOKEN, PORT = 9000, REPO_DIR, PM2_NAME = 'discord-bot' } = process.env;
if (!DEPLOY_AGENT_TOKEN) { console.error('FATAL: DEPLOY_AGENT_TOKEN mangler'); process.exit(1); }
if (!REPO_DIR || !fs.existsSync(REPO_DIR)) { console.error(`FATAL: REPO_DIR "${REPO_DIR}" findes ikke`); process.exit(1); }

const app = express();
app.use(express.json());
app.get('/health', (_q, r) => r.json({ ok: true, ts: Date.now() }));
app.use('/bot', (req, res, next) => {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (t !== DEPLOY_AGENT_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const run = (cmd) => new Promise((resolve) =>
  exec(cmd, { cwd: REPO_DIR, timeout: 120000 }, (err, stdout, stderr) =>
    resolve({ ok: !err, code: err?.code ?? 0, stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' })));

app.get('/bot/status', async (_q, r) => {
  const [pm2, branch, commit] = await Promise.all([run('pm2 jlist'), run('git rev-parse --abbrev-ref HEAD'), run('git log -1 --pretty=format:"%h %s (%cr)"')]);
  let online = false;
  try { const list = JSON.parse(pm2.stdout || '[]'); online = list.find(p => p.name === PM2_NAME)?.pm2_env?.status === 'online'; } catch (_) {}
  r.json({ online, pm2_name: PM2_NAME, branch: branch.stdout.trim(), commit: commit.stdout.trim() });
});
app.get('/bot/logs', async (req, res) => {
  const lines = Math.min(parseInt(req.query.lines, 10) || 100, 1000);
  res.json(await run(`pm2 logs ${PM2_NAME} --lines ${lines} --nostream --raw`));
});
app.post('/bot/pull',    async (_q, r) => r.json(await run('git pull')));
app.post('/bot/restart', async (_q, r) => r.json(await run(`pm2 restart ${PM2_NAME}`)));
app.post('/bot/start',   async (_q, r) => r.json(await run(`pm2 start ${PM2_NAME}`)));
app.post('/bot/stop',    async (_q, r) => r.json(await run(`pm2 stop ${PM2_NAME}`)));
app.post('/bot/deploy', async (_q, r) => {
  const pull = await run('git pull');
  if (!pull.ok) return r.json({ step: 'pull', ...pull });
  const install = await run('npm install --omit=dev');
  if (!install.ok) return r.json({ step: 'install', ...install });
  const restart = await run(`pm2 restart ${PM2_NAME}`);
  r.json({ step: 'restart', pull, install, restart });
});

app.listen(PORT, '127.0.0.1', () => console.log(`[deploy-agent] listening on 127.0.0.1:${PORT}`));
