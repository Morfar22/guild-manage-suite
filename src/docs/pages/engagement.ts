import type { DocPage } from '../types';

export const engagementPages: DocPage[] = [
  {
    slug: 'leveling',
    category: 'engagement',
    title: { da: 'Leveling & XP', en: 'Leveling & XP' },
    description: {
      da: 'XP system med levels, role rewards og leaderboard. XP gives for beskeder og voice tid.',
      en: 'XP system with levels, role rewards and leaderboard. XP awarded for messages and voice time.',
    },
    commands: [
      { name: '/rank', prefix: '!rank', description: { da: 'Vis dit level og XP', en: 'Show your level and XP' } },
      { name: '/leaderboard', prefix: '!lb', description: { da: 'Top 10 brugere', en: 'Top 10 users' } },
      { name: '/setlevel', description: { da: 'Sæt en brugers level', en: 'Set user level' }, permission: 'ADMINISTRATOR' },
    ],
  },
  {
    slug: 'economy',
    category: 'engagement',
    title: { da: 'Økonomi', en: 'Economy' },
    description: {
      da: 'Virtuel valuta med daily rewards, work, gambling, shop og overførsler.',
      en: 'Virtual currency with daily rewards, work, gambling, shop and transfers.',
    },
    commands: [
      { name: '/balance', prefix: '!bal', description: { da: 'Vis din saldo', en: 'Show your balance' } },
      { name: '/daily', description: { da: 'Få daglig belønning', en: 'Claim daily reward' } },
      { name: '/work', description: { da: 'Arbejd for penge', en: 'Work for money' } },
      { name: '/pay', description: { da: 'Send penge til en bruger', en: 'Send money to a user' } },
    ],
  },
  {
    slug: 'giveaways',
    category: 'engagement',
    title: { da: 'Giveaways', en: 'Giveaways' },
    description: {
      da: 'Opret giveaways med rolle krav, multiple vindere og automatisk reroll.',
      en: 'Create giveaways with role requirements, multiple winners and automatic reroll.',
    },
    commands: [
      { name: '/gstart', description: { da: 'Start et giveaway', en: 'Start a giveaway' } },
      { name: '/gend', description: { da: 'Afslut et giveaway tidligt', en: 'End a giveaway early' } },
      { name: '/greroll', description: { da: 'Reroll vindere', en: 'Reroll winners' } },
    ],
  },
  {
    slug: 'starboard',
    category: 'engagement',
    title: { da: 'Starboard', en: 'Starboard' },
    description: {
      da: 'Beskeder med nok ⭐ reaktioner reposts automatisk i en starboard kanal.',
      en: 'Messages with enough ⭐ reactions are automatically reposted in a starboard channel.',
    },
  },
  {
    slug: 'polls',
    category: 'engagement',
    title: { da: 'Afstemninger', en: 'Polls' },
    description: {
      da: 'Opret rich polls med flere muligheder, skjulte stemmer og automatisk lukketid.',
      en: 'Create rich polls with multiple options, hidden votes and auto-close timer.',
    },
  },
  {
    slug: 'suggestions',
    category: 'engagement',
    title: { da: 'Forslag', en: 'Suggestions' },
    description: {
      da: 'Forslags system med upvotes/downvotes, status (godkendt/afvist/implementeret) og kommentarer.',
      en: 'Suggestion system with upvotes/downvotes, status (approved/denied/implemented) and comments.',
    },
  },
  {
    slug: 'reaction-roles',
    category: 'engagement',
    title: { da: 'Reaction Roles', en: 'Reaction Roles' },
    description: {
      da: 'Knap-baserede roller. Brugere klikker for at få/fjerne en rolle.',
      en: 'Button-based roles. Users click to get/remove a role.',
    },
  },
  {
    slug: 'counting',
    category: 'engagement',
    title: { da: 'Counting kanal', en: 'Counting channel' },
    description: {
      da: 'En kanal hvor brugere skal tælle 1, 2, 3... Forkerte tal sletter beskeden.',
      en: 'A channel where users count 1, 2, 3... Wrong numbers delete the message.',
    },
  },
  {
    slug: 'confessions',
    category: 'engagement',
    title: { da: 'Confessions', en: 'Confessions' },
    description: {
      da: 'Anonyme confessions sendt via DM til botten og posted i en confession kanal.',
      en: 'Anonymous confessions sent via DM to the bot and posted in a confession channel.',
    },
  },
  {
    slug: 'birthdays',
    category: 'engagement',
    title: { da: 'Fødselsdage', en: 'Birthdays' },
    description: {
      da: 'Tracker brugeres fødselsdage og sender automatisk besked på dagen.',
      en: 'Tracks user birthdays and sends an automatic message on the day.',
    },
  },
  {
    slug: 'music-quiz',
    category: 'engagement',
    title: { da: 'Music Quiz', en: 'Music Quiz' },
    description: {
      da: 'Spil sang-gættelege i voice kanaler. Brugere skriver navn på sangen for point.',
      en: 'Play song guessing games in voice channels. Users type the song name for points.',
    },
  },
  {
    slug: 'currency-shop',
    category: 'engagement',
    title: { da: 'Currency Shop', en: 'Currency Shop' },
    description: {
      da: 'Shop hvor brugere kan købe roller, items eller perks for økonomi-valuta.',
      en: 'Shop where users buy roles, items or perks with economy currency.',
    },
  },
];
