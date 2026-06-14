import type { ApplicationQuestion } from '@/hooks/useApplicationForms';

export interface ApplicationFormTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'staff' | 'community' | 'gaming' | 'creator';
  questions: Omit<ApplicationQuestion, 'id'>[];
}

function q(label: string, type: ApplicationQuestion['type'] = 'short', required = true, placeholder?: string, options?: string[]): Omit<ApplicationQuestion, 'id'> {
  return { label, type, required, placeholder, options };
}

export const APPLICATION_TEMPLATES: ApplicationFormTemplate[] = [
  {
    id: 'staff',
    name: 'Staff Application',
    emoji: '🛡️',
    description: 'Recruit moderators and staff members',
    category: 'staff',
    questions: [
      q('Hvad er dit fulde navn?', 'short'),
      q('Hvor gammel er du?', 'number', true, 'Din alder', undefined),
      q('Hvilken tidszone er du i?', 'short', true, 'fx CET / GMT+1'),
      q('Hvor mange timer om ugen kan du afsætte?', 'short'),
      q('Har du tidligere staff-erfaring? Hvor?', 'long', true, 'Beskriv tidligere servere og roller'),
      q('Hvorfor vil du gerne være staff hos os?', 'long'),
      q('Hvordan ville du håndtere en konflikt mellem to medlemmer?', 'long'),
    ],
  },
  {
    id: 'moderator',
    name: 'Moderator Application',
    emoji: '⚖️',
    description: 'Focused moderator recruitment form',
    category: 'staff',
    questions: [
      q('Discord brugernavn', 'short'),
      q('Alder', 'number'),
      q('Tidszone', 'short'),
      q('Aktive timer om ugen', 'short'),
      q('Tidligere moderator-erfaring', 'long', false),
      q('Hvordan håndterer du en bruger der spammer?', 'long'),
      q('Hvad er den vigtigste egenskab hos en god moderator?', 'long'),
    ],
  },
  {
    id: 'whitelist',
    name: 'Whitelist Application',
    emoji: '✅',
    description: 'FiveM / Minecraft / RP whitelist',
    category: 'gaming',
    questions: [
      q('In-game navn / karakter navn', 'short'),
      q('Steam / Game ID', 'short', false),
      q('Alder', 'number'),
      q('Hvor meget RP-erfaring har du?', 'select', true, undefined, ['Ingen', '0-6 måneder', '6-12 måneder', '1-2 år', '2+ år']),
      q('Skriv din karakters baggrundshistorie (min. 5 sætninger)', 'long'),
      q('Hvad er forskellen på IC og OOC?', 'long'),
      q('Hvad er metagaming og powergaming?', 'long'),
      q('Hvorfor vil du spille på vores server?', 'long'),
    ],
  },
  {
    id: 'event-team',
    name: 'Event Team Application',
    emoji: '🎉',
    description: 'For event planners and hosts',
    category: 'community',
    questions: [
      q('Navn / brugernavn', 'short'),
      q('Alder', 'number'),
      q('Har du tidligere planlagt events? Hvilke?', 'long'),
      q('Beskriv et event du gerne vil køre hos os', 'long'),
      q('Hvor mange events om måneden kan du hoste?', 'short'),
      q('Hvilke typer events er du bedst til?', 'select', true, undefined, ['Gaming turneringer', 'Trivia / Quiz', 'Movie nights', 'Giveaways', 'Community samtaler', 'Andet']),
    ],
  },
  {
    id: 'builder',
    name: 'Builder Application',
    emoji: '🏗️',
    description: 'For server builders / map makers',
    category: 'gaming',
    questions: [
      q('Brugernavn', 'short'),
      q('Alder', 'number'),
      q('Hvilke programmer / tools bruger du?', 'short'),
      q('Link til portfolio eller tidligere builds', 'long'),
      q('Hvor mange timer om ugen kan du bygge?', 'short'),
      q('Hvad er din stærkeste byggestil?', 'short'),
    ],
  },
  {
    id: 'developer',
    name: 'Developer Application',
    emoji: '💻',
    description: 'For scripters & developers',
    category: 'staff',
    questions: [
      q('Navn', 'short'),
      q('Alder', 'number'),
      q('Hvilke sprog/frameworks kender du?', 'short', true, 'fx Lua, JS/TS, React, Node'),
      q('Link til GitHub eller portfolio', 'short', false),
      q('Beskriv dit største projekt', 'long'),
      q('Hvor mange timer om ugen kan du arbejde?', 'short'),
    ],
  },
  {
    id: 'content-creator',
    name: 'Content Creator',
    emoji: '🎥',
    description: 'Partner program for streamers / YouTubers',
    category: 'creator',
    questions: [
      q('Brugernavn', 'short'),
      q('Platform', 'select', true, undefined, ['Twitch', 'YouTube', 'TikTok', 'Andet']),
      q('Link til kanal', 'short'),
      q('Antal følgere / subs', 'short'),
      q('Gennemsnitlige viewers', 'short'),
      q('Hvor ofte streamer/uploader du?', 'short'),
      q('Hvorfor vil du være partner hos os?', 'long'),
    ],
  },
  {
    id: 'partnership',
    name: 'Server Partnership',
    emoji: '🤝',
    description: 'For server-til-server samarbejder',
    category: 'community',
    questions: [
      q('Server navn', 'short'),
      q('Invite link', 'short'),
      q('Antal medlemmer', 'number'),
      q('Server emne / niche', 'short'),
      q('Hvad tilbyder I i partnerskabet?', 'long'),
      q('Hvad forventer I fra os?', 'long'),
    ],
  },
  {
    id: 'unban',
    name: 'Unban Appeal',
    emoji: '🔓',
    description: 'For at appellere et ban',
    category: 'community',
    questions: [
      q('Discord ID', 'short'),
      q('Hvornår blev du banned?', 'short'),
      q('Hvad blev du banned for? (din egen forståelse)', 'long'),
      q('Hvorfor mener du, du fortjener en unban?', 'long'),
      q('Hvad har du lært?', 'long'),
    ],
  },
  {
    id: 'support',
    name: 'Support Team',
    emoji: '🎧',
    description: 'Helpdesk og ticket-support',
    category: 'staff',
    questions: [
      q('Navn', 'short'),
      q('Alder', 'number'),
      q('Tidszone', 'short'),
      q('Timer om ugen', 'short'),
      q('Hvordan håndterer du en frustreret bruger?', 'long'),
      q('Tidligere support-erfaring', 'long', false),
    ],
  },
];
