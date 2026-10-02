module.exports = {
  apps: [
    {
      name: 'guildos-lavalink',
      script: './scripts/start-lavalink.sh',
      cwd: __dirname,
      interpreter: '/bin/bash',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      error_file: './logs/lavalink-error.log',
      out_file: './logs/lavalink-output.log',
      merge_logs: true,
      time: true,
    },
  ],
};
