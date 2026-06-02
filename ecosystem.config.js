/**
 * PM2 Ecosystem Configuration
 * 
 * Start med: pm2 start ecosystem.config.js
 * Logs: pm2 logs discord-bot
 * Restart: pm2 restart discord-bot
 * Stop: pm2 stop discord-bot
 */
module.exports = {
  apps: [
    {
      name: 'discord-bot',
      script: 'bot.js',
      cwd: __dirname,
      env_file: '.env',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,
      time: true,
    },
  ],
};
