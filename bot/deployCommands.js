/**
 * Deploy Slash Commands to Discord
 * 
 * Run this script once (or after adding new commands) to register
 * all slash commands with Discord's API.
 * 
 * Usage: node bot/deployCommands.js
 * 
 * Required environment variables:
 * - DEFAULT_BOT_TOKEN (or DISCORD_TOKEN)
 * - APPLICATION_ID (your bot's application/client ID)
 */

require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DEFAULT_BOT_TOKEN || process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

if (!TOKEN || !APPLICATION_ID) {
  console.error('❌ Missing DEFAULT_BOT_TOKEN or APPLICATION_ID in environment variables');
  process.exit(1);
}

const commands = [
  // ==================== MODERATION ====================
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban en bruger fra serveren')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal bannes').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til ban'))
    .addIntegerOption(o => o.setName('delete_messages').setDescription('Antal dage beskeder der skal slettes (0-7)')),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban en bruger')
    .addStringOption(o => o.setName('user_id').setDescription('Brugerens ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til unban')),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick en bruger fra serveren')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal kickes').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til kick')),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal mutes').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('Varighed i minutter (standard: 10)'))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til mute')),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal unmutes').setRequired(true)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Advar en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal advares').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til advarsel').setRequired(true)),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Se advarsler for en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Slet beskeder i kanalen')
    .addIntegerOption(o => o.setName('amount').setDescription('Antal beskeder (1-100)').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Kun beskeder fra denne bruger')),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Sæt slowmode på kanalen')
    .addIntegerOption(o => o.setName('seconds').setDescription('Sekunder (0 = deaktiver)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lås en kanal')
    .addChannelOption(o => o.setName('channel').setDescription('Kanalen der skal låses')),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Lås en kanal op')
    .addChannelOption(o => o.setName('channel').setDescription('Kanalen der skal låses op')),

  new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Softban en bruger (ban + unban for at slette beskeder)')
    .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag')),

  // ==================== MUSIC ====================
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Afspil musik')
    .addStringOption(o => o.setName('query').setDescription('Sang eller URL').setRequired(true)),

  new SlashCommandBuilder().setName('skip').setDescription('Skip den nuværende sang'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop musikken og forlad kanalen'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause musikken'),
  new SlashCommandBuilder().setName('resume').setDescription('Genoptag musikken'),
  new SlashCommandBuilder().setName('queue').setDescription('Se musikken i køen'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Se den nuværende sang'),

  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Juster lydstyrken')
    .addIntegerOption(o => o.setName('level').setDescription('Lydstyrke (0-100)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Gentag sang eller kø')
    .addStringOption(o => o.setName('mode').setDescription('off / track / queue').setRequired(true)
      .addChoices(
        { name: 'Off', value: 'off' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' },
      )),

  new SlashCommandBuilder().setName('shuffle').setDescription('Bland køen'),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Fjern en sang fra køen')
    .addIntegerOption(o => o.setName('position').setDescription('Position i køen').setRequired(true)),

  new SlashCommandBuilder()
    .setName('move')
    .setDescription('Flyt en sang i køen')
    .addIntegerOption(o => o.setName('from').setDescription('Fra position').setRequired(true))
    .addIntegerOption(o => o.setName('to').setDescription('Til position').setRequired(true)),

  new SlashCommandBuilder()
    .setName('jump')
    .setDescription('Hop til en sang i køen')
    .addIntegerOption(o => o.setName('position').setDescription('Position').setRequired(true)),

  // ==================== LEVELING ====================
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Se din eller en brugers rank')
    .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Se XP leaderboard'),

  // ==================== UTILITY ====================
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Se alle tilgængelige kommandoer')
    .addStringOption(o => o.setName('category').setDescription('Kategori')
      .addChoices(
        { name: 'Moderation', value: 'moderation' },
        { name: 'Musik', value: 'music' },
        { name: 'Leveling', value: 'leveling' },
        { name: 'Utility', value: 'utility' },
        { name: 'Fun', value: 'fun' },
        { name: 'Economy', value: 'economy' },
        { name: 'Giveaway', value: 'giveaway' },
        { name: 'Suggestion', value: 'suggestion' },
        { name: 'AFK', value: 'afk' },
        { name: 'Tebex', value: 'tebex' },
      )),

  new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Se alle tilgængelige kommandoer (alias for /help)')
    .addStringOption(o => o.setName('category').setDescription('Kategori')
      .addChoices(
        { name: 'Moderation', value: 'moderation' },
        { name: 'Musik', value: 'music' },
        { name: 'Leveling', value: 'leveling' },
        { name: 'Utility', value: 'utility' },
        { name: 'Fun', value: 'fun' },
        { name: 'Economy', value: 'economy' },
        { name: 'Giveaway', value: 'giveaway' },
        { name: 'Suggestion', value: 'suggestion' },
        { name: 'AFK', value: 'afk' },
        { name: 'Tebex', value: 'tebex' },
      )),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Se bottens latency'),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Se info om serveren'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Se info om en bruger')
    .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Se en brugers avatar')
    .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Opret en afstemning')
    .addStringOption(o => o.setName('question').setDescription('Spørgsmål').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Valgmuligheder adskilt med | (f.eks. Ja|Nej|Måske)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Sæt en påmindelse')
    .addStringOption(o => o.setName('time').setDescription('Tid (f.eks. 10m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Påmindelsesbesked').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ticket-remind')
    .setDescription('Påmind ticket-ejeren om at svare (auto-sletning efter 12 timer)'),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Opret en ny ticket/support-sag'),

  new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Luk den aktuelle ticket')
    .addBooleanOption(o => o.setName('delete').setDescription('Slet tråden i stedet for at arkivere')),

  new SlashCommandBuilder()
    .setName('ticket-claim')
    .setDescription('Claim den aktuelle ticket som din'),

  new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Tilføj en bruger til den aktuelle ticket')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal tilføjes').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('Fjern en bruger fra den aktuelle ticket')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal fjernes').setRequired(true)),

  // ==================== FUN ====================
  new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Spørg den magiske 8-ball')
    .addStringOption(o => o.setName('question').setDescription('Dit spørgsmål').setRequired(true)),

  new SlashCommandBuilder().setName('coinflip').setDescription('Slå plat eller krone'),
  new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Kast en terning')
    .addIntegerOption(o => o.setName('sides').setDescription('Antal sider (standard: 6)')),

  new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Spil sten-saks-papir')
    .addStringOption(o => o.setName('choice').setDescription('Dit valg').setRequired(true)
      .addChoices(
        { name: 'Sten', value: 'sten' },
        { name: 'Saks', value: 'saks' },
        { name: 'Papir', value: 'papir' },
      )),

  new SlashCommandBuilder().setName('joke').setDescription('Få en tilfældig joke'),
  new SlashCommandBuilder().setName('meme').setDescription('Få et tilfældigt meme'),

  new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Ship to brugere')
    .addUserOption(o => o.setName('user1').setDescription('Første bruger').setRequired(true))
    .addUserOption(o => o.setName('user2').setDescription('Anden bruger').setRequired(true)),

  new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Bedøm noget')
    .addStringOption(o => o.setName('thing').setDescription('Hvad skal bedømmes?').setRequired(true)),

  // ==================== ECONOMY ====================
  new SlashCommandBuilder().setName('daily').setDescription('Hent din daglige belønning'),
  new SlashCommandBuilder().setName('work').setDescription('Arbejd for at tjene penge'),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Se din eller en brugers balance')
    .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),

  new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Betal en bruger')
    .addUserOption(o => o.setName('user').setDescription('Modtager').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),

  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Indsæt penge i banken')
    .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),

  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Hæv penge fra banken')
    .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),

  new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Røv en bruger')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true)),

  new SlashCommandBuilder().setName('richest').setDescription('Se de rigeste brugere'),

  // ==================== AFK ====================
  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Sæt din AFK status')
    .addStringOption(o => o.setName('message').setDescription('AFK besked (valgfri)')),

  // ==================== EXTRA MODERATION ====================
  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Slet alle advarsler for en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Giv en bruger timeout')
    .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('Varighed i minutter (standard: 10)'))
    .addStringOption(o => o.setName('reason').setDescription('Årsag')),

  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Fjern timeout fra en bruger')
    .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),

  new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Slet alle beskeder i kanalen (genskaber kanalen)'),

  // ==================== TEBEX ====================
  new SlashCommandBuilder()
    .setName('tebex-verify')
    .setDescription('Verificer et Tebex køb')
    .addStringOption(o => o.setName('transaction_id').setDescription('Transaktions-ID').setRequired(true)),

  // ==================== GIVEAWAY ====================
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Administrer giveaways')
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Start en giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Præmie').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Varighed (f.eks. 1h, 1d)').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Antal vindere (standard: 1)'))
      .addStringOption(o => o.setName('description').setDescription('Beskrivelse'))
    )
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('Afslut en giveaway tidligt')
      .addStringOption(o => o.setName('message_id').setDescription('Giveaway besked-ID').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('Vælg nye vindere')
      .addStringOption(o => o.setName('message_id').setDescription('Giveaway besked-ID').setRequired(true))
    ),

  // ==================== SUGGESTION ====================
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Send et forslag')
    .addStringOption(o => o.setName('suggestion').setDescription('Dit forslag').setRequired(true)),

  // ==================== GLOBAL BAN REPORT ====================
  new SlashCommandBuilder()
    .setName('globalban-report')
    .setDescription('Rapportér en bruger til det globale ban-system')
    .addUserOption(o => o.setName('user').setDescription('Brugeren der skal rapporteres').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Årsag til rapporten').setRequired(true))
    .addStringOption(o => o.setName('severity').setDescription('Alvorlighed/kategori')
      .addChoices(
        { name: 'Cheating', value: 'cheating' },
        { name: 'Chikane', value: 'harassment' },
        { name: 'Scam', value: 'scam' },
        { name: 'Raiding', value: 'raiding' },
        { name: 'ToS Overtrædelse', value: 'tos_violation' },
        { name: 'Andet', value: 'other' },
      ))
    .addStringOption(o => o.setName('evidence').setDescription('Link til beviser (valgfri)')),

  // ==================== MUSIC QUIZ ====================
  new SlashCommandBuilder()
    .setName('musicquiz')
    .setDescription('Musik Quiz - gæt sangen!')
    .addSubcommand(s => s.setName('start').setDescription('Start en musik quiz i quiz-kanalen'))
    .addSubcommand(s => s.setName('stop').setDescription('Stop den aktive quiz'))
    .addSubcommand(s => s.setName('skip').setDescription('Spring nuværende runde over'))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Vis top spillere')),

  // ==================== ADMIN / TEST ====================
  new SlashCommandBuilder()
    .setName('testall')
    .setDescription('Test alle bot-kommandoer og handlers (kun admin)')
    .addBooleanOption(o => o.setName('verbose').setDescription('Vis detaljer for hver kommando')),

  // ==================== UTILITY (NYE) ====================
  new SlashCommandBuilder().setName('uptime').setDescription('Se hvor længe botten har kørt'),
  new SlashCommandBuilder().setName('stats').setDescription('Se statistik for serveren'),
  new SlashCommandBuilder().setName('invite').setDescription('Få et invite-link til botten'),
  new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Beregn et matematisk udtryk')
    .addStringOption(o => o.setName('expression').setDescription('F.eks. (5+3)*2').setRequired(true)),
  new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Vis info om en kanal')
    .addChannelOption(o => o.setName('channel').setDescription('Kanalen (standard: denne)')),
  new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Vis info om en rolle')
    .addRoleOption(o => o.setName('role').setDescription('Rollen').setRequired(true)),
  new SlashCommandBuilder().setName('roles').setDescription('Vis alle roller på serveren'),
  new SlashCommandBuilder().setName('members').setDescription('Vis medlemsstatistik'),
  new SlashCommandBuilder().setName('emojis').setDescription('Vis serverens emojis'),
  new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Vis en brugers banner')
    .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),
  new SlashCommandBuilder().setName('snipe').setDescription('Vis den senest slettede besked i kanalen'),
  new SlashCommandBuilder().setName('editsnipe').setDescription('Vis den senest redigerede besked i kanalen'),
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send en embed-besked')
    .addStringOption(o => o.setName('description').setDescription('Indhold').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Titel'))
    .addStringOption(o => o.setName('color').setDescription('Hex-farve, f.eks. #5865F2'))
    .addChannelOption(o => o.setName('channel').setDescription('Kanal (standard: denne)')),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send en meddelelse')
    .addStringOption(o => o.setName('message').setDescription('Beskeden').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Kanal (standard: denne)'))
    .addStringOption(o => o.setName('ping').setDescription('Ping').addChoices(
      { name: '@everyone', value: 'everyone' },
      { name: '@here', value: 'here' },
      { name: 'Ingen', value: 'none' },
    )),
  new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Citér en besked fra denne kanal')
    .addStringOption(o => o.setName('message_id').setDescription('Besked-ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Start en hurtig ja/nej afstemning')
    .addStringOption(o => o.setName('question').setDescription('Spørgsmålet').setRequired(true)),

  // ==================== FUN (NYE) ====================
  new SlashCommandBuilder()
    .setName('ascii')
    .setDescription('Lav ASCII-tekst')
    .addStringOption(o => o.setName('text').setDescription('Tekst (maks 12 tegn)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('mock')
    .setDescription('SpOtTeNdE tEkSt')
    .addStringOption(o => o.setName('text').setDescription('Tekst').setRequired(true)),
  new SlashCommandBuilder()
    .setName('reverse')
    .setDescription('Vend tekst om')
    .addStringOption(o => o.setName('text').setDescription('Tekst').setRequired(true)),
  new SlashCommandBuilder().setName('fact').setDescription('Få en tilfældig sjov fakta'),

  // ==================== ECONOMY (NYE) ====================
  new SlashCommandBuilder().setName('shop').setDescription('Se butikken'),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Køb en vare i butikken')
    .addStringOption(o => o.setName('item').setDescription('Varens navn eller nummer').setRequired(true)),
  new SlashCommandBuilder().setName('inventory').setDescription('Se dine købte varer'),
  new SlashCommandBuilder().setName('crime').setDescription('Begå kriminalitet for penge (30 min cooldown)'),
  new SlashCommandBuilder().setName('weekly').setDescription('Hent din ugentlige belønning'),
  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spil på enarmet tyveknægt')
    .addIntegerOption(o => o.setName('bet').setDescription('Indsats').setRequired(true)),
  new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gamble dine penge')
    .addIntegerOption(o => o.setName('bet').setDescription('Indsats').setRequired(true)),
  new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Spil roulette')
    .addIntegerOption(o => o.setName('bet').setDescription('Indsats').setRequired(true))
    .addStringOption(o => o.setName('choice').setDescription('Dit valg').setRequired(true).addChoices(
      { name: 'Rød', value: 'red' },
      { name: 'Sort', value: 'black' },
      { name: 'Grøn (0)', value: 'green' },
      { name: 'Lige', value: 'even' },
      { name: 'Ulige', value: 'odd' },
    )),

  // ==================== LEVELING ADMIN (NYE) ====================
  new SlashCommandBuilder()
    .setName('addxp').setDescription('Tilføj XP til en bruger')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Antal XP').setRequired(true)),
  new SlashCommandBuilder()
    .setName('removexp').setDescription('Fjern XP fra en bruger')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Antal XP').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setxp').setDescription('Sæt en brugers XP')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('XP').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setlevel').setDescription('Sæt en brugers level')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true))
    .addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true)),
  new SlashCommandBuilder()
    .setName('resetxp').setDescription('Nulstil en brugers XP')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true)),
  new SlashCommandBuilder().setName('resetleaderboard').setDescription('Nulstil hele XP-leaderboardet (admin)'),

  // ==================== TICKET / GIVEAWAY ALIASER ====================
  new SlashCommandBuilder()
    .setName('close').setDescription('Luk denne ticket')
    .addBooleanOption(o => o.setName('delete').setDescription('Slet tråden bagefter')),
  new SlashCommandBuilder().setName('claim').setDescription('Overtag denne ticket'),
  new SlashCommandBuilder().setName('unclaim').setDescription('Frigiv denne ticket'),
  new SlashCommandBuilder()
    .setName('add').setDescription('Tilføj en bruger til denne ticket')
    .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true)),
  new SlashCommandBuilder()
    .setName('rename').setDescription('Omdøb denne tråd')
    .addStringOption(o => o.setName('name').setDescription('Nyt navn').setRequired(true)),
  new SlashCommandBuilder()
    .setName('gstart').setDescription('Start en giveaway (alias)')
    .addStringOption(o => o.setName('prize').setDescription('Præmie').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Varighed, f.eks. 1h').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Antal vindere'))
    .addStringOption(o => o.setName('description').setDescription('Beskrivelse')),
  new SlashCommandBuilder()
    .setName('gend').setDescription('Afslut en giveaway (alias)')
    .addStringOption(o => o.setName('message_id').setDescription('Besked-ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('greroll').setDescription('Vælg nye vindere (alias)')
    .addStringOption(o => o.setName('message_id').setDescription('Besked-ID').setRequired(true)),
  new SlashCommandBuilder().setName('glist').setDescription('Vis aktive giveaways'),
];


const rest = new REST({ version: '10' }).setToken(TOKEN);
const GUILD_ID = process.env.DEPLOY_GUILD_ID;

(async () => {
  try {
    const commandData = commands.map(c => c.toJSON());

    // Deploy globally
    console.log(`🔄 Registrerer ${commands.length} slash commands globalt...`);
    const data = await rest.put(
      Routes.applicationCommands(APPLICATION_ID),
      { body: commandData }
    );
    console.log(`✅ ${data.length} slash commands registreret globalt!`);

    // If a specific guild ID is provided, also deploy there instantly
    if (GUILD_ID) {
      console.log(`🔄 Deployer også til guild ${GUILD_ID} for øjeblikkelig tilgængelighed...`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
        { body: commandData }
      );
      console.log(`✅ ${guildData.length} commands deployed til guild ${GUILD_ID}!`);
    }

    console.log('📝 Registrerede commands:', data.map(c => c.name).join(', '));
    console.log('');
    console.log('⚠️ Globale commands kan tage op til 1 time at blive synkroniseret.');
    console.log('   Brug DEPLOY_GUILD_ID=<id> for øjeblikkelig guild-specifik deployment.');
  } catch (error) {
    console.error('❌ Fejl ved registrering af commands:', error);
  }
})();
