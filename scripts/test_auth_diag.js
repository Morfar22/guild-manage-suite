const { URLSearchParams } = require('url');

const DISCORD_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const REDIRECT_URI = 'https://bot.nethost-solutions.dk/auth';

const params = new URLSearchParams({
  client_id: DISCORD_CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'identify email guilds',
});

console.log('--- Diagnosis Checklist ---');
console.log('1. Verify Discord Developer Portal "Redirects" for: ' + REDIRECT_URI);
console.log('2. Discord Auth URL: https://discord.com/api/oauth2/authorize?' + params.toString());
console.log('3. Ensure "bot.nethost-solutions.dk" is the absolute, exact domain configured.');
