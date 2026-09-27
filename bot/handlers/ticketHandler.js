/**
 * Ticket Handler for Discord Bot
 * 
 * Environment variables required:
 * - BOT_SECRET_KEY: (samme som i Lovable Cloud secrets)
 * - API_URL: https://rkdqunnttcyuybbofkvz.supabase.co/functions/v1/bot-tickets
 * 
 * Usage in your main bot file:
 * const { setupTicketHandler } = require('./ticketHandler');
 * setupTicketHandler(client);
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const API_URL = process.env.API_URL || '${APP_API_BASE}/api/public/bot-tickets';
const BOT_SECRET = process.env.BOT_SECRET_KEY;

// In-memory state for multi-step ticket creation flows (rich select-menu questions).
// Key: `${userId}:${categoryId}`  Value: { answers: [{question, answer}], panelId, expires }
const pendingFlows = new Map();
const FLOW_TTL_MS = 10 * 60 * 1000;
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

function flowKey(userId, categoryId) {
  return `${userId}:${categoryId}`;
}
function getFlow(userId, categoryId) {
  const key = flowKey(userId, categoryId);
  const state = pendingFlows.get(key);
  if (!state) return null;
  if (state.expires < Date.now()) {
    pendingFlows.delete(key);
    return null;
  }
  return state;
}
function setFlow(userId, categoryId, patch) {
  const key = flowKey(userId, categoryId);
  const prev = pendingFlows.get(key) || { answers: [], panelId: null };
  const next = { ...prev, ...patch, expires: Date.now() + FLOW_TTL_MS };
  pendingFlows.set(key, next);
  return next;
}
function clearFlow(userId, categoryId) {
  pendingFlows.delete(flowKey(userId, categoryId));
}
// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingFlows.entries()) {
    if (v.expires < now) pendingFlows.delete(k);
  }
}, 60_000).unref?.();

async function callAPI(action, data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET
    },
    body: JSON.stringify({ action, data })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// ---------------- Operating hours ----------------
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isWithinOperatingHours(hours) {
  if (!hours || !hours.enabled) return { open: true };
  const tz = hours.timezone || 'UTC';
  let dayIdx, hh, mm;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wd = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
    hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    if (hh === 24) hh = 0;
    dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
    if (dayIdx < 0) dayIdx = new Date().getDay();
  } catch {
    const now = new Date();
    dayIdx = now.getDay();
    hh = now.getUTCHours();
    mm = now.getUTCMinutes();
  }
  const dayCfg = hours.days?.[DAY_KEYS[dayIdx]];
  if (!dayCfg || !dayCfg.enabled) {
    return { open: false, message: hours.closed_message || "We're currently closed. Please try again later." };
  }
  const cur = hh * 60 + mm;
  const [oH, oM] = String(dayCfg.open || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const [cH, cM] = String(dayCfg.close || '23:59').split(':').map((n) => parseInt(n, 10) || 0);
  const openMin = oH * 60 + oM;
  const closeMin = cH * 60 + cM;
  const isOpen = closeMin >= openMin
    ? cur >= openMin && cur <= closeMin
    : cur >= openMin || cur <= closeMin; // wraps past midnight
  if (!isOpen) {
    return { open: false, message: hours.closed_message || "We're currently closed. Please try again later." };
  }
  return { open: true };
}


/**
 * Setup ticket handler on Discord client
 * @param {Client} client - Discord.js client
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function setupTicketHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  // Track which channels are ticket threads (populated on ticket creation)
  const ticketChannels = new Set();
  // Track pending auto-delete timers for reminded tickets
  const remindTimers = new Map(); // channelId -> timeoutId

  // Listen for messages in ticket threads and save them
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.channel?.isThread()) return;
    if (message.guild && !shouldHandleGuild(message.guild.id)) return;

    // Cancel auto-delete timer if the ticket creator responds
    if (remindTimers.has(message.channel.id)) {
      const timer = remindTimers.get(message.channel.id);
      if (message.author.id === timer.creatorId) {
        clearTimeout(timer.timeout);
        remindTimers.delete(message.channel.id);
        console.log(`[Tickets] Auto-delete cancelled for ${message.channel.id} — creator responded`);
      }
    }

    // Save every message in a thread to the ticket_messages table
    // The API will silently fail if the thread isn't a ticket thread
    try {
      await callAPI('saveMessage', {
        ticketChannelId: message.channel.id,
        authorId: message.author.id,
        authorName: message.author.username,
        authorAvatar: message.author.displayAvatarURL?.({ dynamic: true }) || null,
        content: message.content || '',
        attachments: message.attachments?.size > 0 
          ? [...message.attachments.values()].map(a => ({ url: a.url, name: a.name, size: a.size }))
          : null,
      });
    } catch (err) {
      // Silently ignore - thread might not be a ticket
    }
  });

  client.on('interactionCreate', async (interaction) => {
    // Check if this bot instance should handle this guild
    if (interaction.guild && !shouldHandleGuild(interaction.guild.id)) return;

    // Handle /ticket-remind slash command
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket-remind') {
      try {
        await handleTicketRemind(interaction, remindTimers);
      } catch (error) {
        console.error('Ticket remind error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle /ticket - create a new ticket via slash command
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket') {
      try {
        await handleTicketSlashCreate(interaction);
      } catch (error) {
        console.error('Ticket create error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle /ticket-close
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket-close') {
      try {
        if (!interaction.channel?.isThread()) {
          return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', ephemeral: true });
        }
        const deleteThread = interaction.options.getBoolean('delete') || false;
        await handleCloseTicket(interaction, interaction.channel.id, deleteThread);
      } catch (error) {
        console.error('Ticket close error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle /ticket-claim
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket-claim') {
      try {
        if (!interaction.channel?.isThread()) {
          return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', ephemeral: true });
        }
        await handleClaimTicket(interaction, interaction.channel.id);
      } catch (error) {
        console.error('Ticket claim error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle /ticket-add
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket-add') {
      try {
        if (!interaction.channel?.isThread()) {
          return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', ephemeral: true });
        }
        const user = interaction.options.getUser('user');
        await interaction.channel.members.add(user.id);
        await interaction.reply({ content: `✅ <@${user.id}> er blevet tilføjet til denne ticket.`, ephemeral: true });
      } catch (error) {
        console.error('Ticket add error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Kunne ikke tilføje brugeren.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle /ticket-remove
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'ticket-remove') {
      try {
        if (!interaction.channel?.isThread()) {
          return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', ephemeral: true });
        }
        const user = interaction.options.getUser('user');
        await interaction.channel.members.remove(user.id);
        await interaction.reply({ content: `✅ <@${user.id}> er blevet fjernet fra denne ticket.`, ephemeral: true });
      } catch (error) {
        console.error('Ticket remove error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Kunne ikke fjerne brugeren.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Helper: strip trailing panel-uuid suffix from custom_id
    const stripPanelSuffix = (rest) => {
      const parts = rest.split('_');
      if (parts.length > 1 && parts[parts.length - 1].length === 36 && parts[parts.length - 1].includes('-')) {
        return { id: parts.slice(0, -1).join('_'), panelId: parts[parts.length - 1] };
      }
      return { id: rest, panelId: null };
    };

    // Handle ticket category select (dropdown from panel) — supports optional _<panelId> suffix
    if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('ticket_category_select')) {
      try {
        const rest = interaction.customId.replace('ticket_category_select', '').replace(/^_/, '');
        const { panelId } = rest ? stripPanelSuffix(rest) : { panelId: null };
        const categoryId = interaction.values?.[0];
        if (!categoryId) {
          return interaction.reply({ content: '❌ Ingen kategori valgt.', ephemeral: true });
        }
        await startTicketFlow(interaction, categoryId, panelId);
      } catch (error) {
        console.error('Select category handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle rich-field select-menu pick (multi-step flow)
    if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('ticket_pick_')) {
      try {
        await handlePickSubmit(interaction);
      } catch (error) {
        console.error('Pick handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    // Handle modal submit (both application and support tickets with questions)
    if (interaction.isModalSubmit?.() && interaction.customId?.startsWith('ticket_modal_')) {
      try {
        await handleTicketModalSubmit(interaction);
      } catch (error) {
        console.error('Modal submit handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Ticket rating buttons: ticket_rate_<ticketUuid>_<1-5>
    if (customId.startsWith('ticket_rate_')) {
      try {
        await handleRateTicket(interaction);
      } catch (error) {
        console.error('Rating handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Kunne ikke gemme rating.', ephemeral: true }).catch(console.error);
        }
      }
      return;
    }

    try {
      if (customId.startsWith('ticket_create_')) {
        const { id: categoryId, panelId } = stripPanelSuffix(customId.replace('ticket_create_', ''));
        await startTicketFlow(interaction, categoryId, panelId);
        return;
      }
      if (customId.startsWith('ticket_claim_')) {
        await handleClaimTicket(interaction, customId.replace('ticket_claim_', ''));
        return;
      }
      if (customId.startsWith('ticket_close_')) {
        await handleCloseTicket(interaction, customId.replace('ticket_close_', ''), false);
        return;
      }
      if (customId.startsWith('ticket_delete_')) {
        await handleCloseTicket(interaction, customId.replace('ticket_delete_', ''), true);
        return;
      }
    } catch (error) {
      console.error('Ticket handler error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Der opstod en fejl.', ephemeral: true }).catch(console.error);
      }
    }
  });

  console.log('✅ Ticket handler initialized');
}


async function handleTicketSlashCreate(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild.id;

  // Get ticket categories for this guild
  const { categories } = await callAPI('getCategories', { guildId });

  if (!categories || categories.length === 0) {
    return interaction.editReply({ content: '❌ Der er ingen ticket-kategorier sat op endnu. En administrator skal først konfigurere tickets i dashboardet.' });
  }

  if (categories.length === 1) {
    // Only one category - start flow directly
    await startTicketFlow(interaction, categories[0].id, null);
    return;
  }

  // Multiple categories - show select menu
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_category_select')
    .setPlaceholder('Vælg en kategori')
    .addOptions(
      categories.map(c => ({
        label: `${c.emoji || '🎫'} ${c.name}`.substring(0, 100),
        description: (c.description || 'Opret en ticket').substring(0, 100),
        value: c.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.editReply({
    content: '📋 Vælg en ticket-kategori:',
    components: [row],
  });
}

// ---------------- New multi-step ticket flow ----------------

function splitQuestions(category) {
  const all = Array.isArray(category.questions) ? category.questions : [];
  const selectQuestions = all.filter((q) => q.style === 'select' && Array.isArray(q.options) && q.options.length > 0);
  const textQuestions = all.filter((q) => q.style !== 'select').slice(0, 5);
  return { selectQuestions, textQuestions };
}

async function startTicketFlow(interaction, categoryId, panelId) {
  // Fetch category
  const { category } = await callAPI('getCategory', { categoryId });
  if (!category) {
    const reply = { content: '❌ Kategori ikke fundet.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.editReply(reply);
    return interaction.reply(reply);
  }

  // Operating hours check (panel override → settings fallback)
  const { settings } = await callAPI('getSettings', { guildId: category.guild_id, panelId: panelId || undefined });
  const hoursCheck = isWithinOperatingHours(settings?.operating_hours);
  if (!hoursCheck.open) {
    const reply = { content: `🕒 ${hoursCheck.message}`, ephemeral: true, components: [] };
    if (interaction.isStringSelectMenu?.() && !interaction.deferred && !interaction.replied) {
      return interaction.update(reply).catch(() => interaction.reply(reply));
    }
    if (interaction.deferred || interaction.replied) return interaction.editReply(reply);
    return interaction.reply(reply);
  }

  const { selectQuestions, textQuestions } = splitQuestions(category);

  // Initialize flow state
  setFlow(interaction.user.id, categoryId, {
    panelId: panelId || null,
    selectQuestions,
    textQuestions,
    selectAnswers: [],
    currentSelectIdx: 0,
    category,
    settings,
  });

  if (selectQuestions.length > 0) {
    // Ask the first rich select question
    return askNextSelect(interaction, categoryId, /*firstTime*/ true);
  }

  if (textQuestions.length > 0) {
    return showTextModal(interaction, category, textQuestions);
  }

  // Nothing to ask — create ticket
  clearFlow(interaction.user.id, categoryId);
  await handleCreateTicket(interaction, categoryId, [], category, settings);
}

function showTextModal(interaction, category, textQuestions) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${category.id}`)
    .setTitle(`${category.emoji || '🎫'} ${category.name}`.substring(0, 45));

  const rows = textQuestions.slice(0, 5).map((q, index) => {
    const input = new TextInputBuilder()
      .setCustomId(`question_${index}`)
      .setLabel(String(q.label || `Spørgsmål ${index + 1}`).substring(0, 45))
      .setRequired(q.required !== false)
      .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short);
    if (q.placeholder) input.setPlaceholder(String(q.placeholder).substring(0, 100));
    return new ActionRowBuilder().addComponents(input);
  });

  modal.addComponents(rows);
  return interaction.showModal(modal);
}

async function askNextSelect(interaction, categoryId, firstTime = false) {
  const state = getFlow(interaction.user.id, categoryId);
  if (!state) {
    const reply = { content: '⚠️ Din session udløb. Prøv igen.', ephemeral: true, components: [] };
    if (interaction.deferred || interaction.replied) return interaction.editReply(reply);
    return interaction.reply(reply);
  }

  const q = state.selectQuestions[state.currentSelectIdx];
  const optionCount = Math.min(q.options.length, 25);
  const maxValues = q.multi ? optionCount : 1;
  const minValues = q.required === false ? 0 : 1;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`ticket_pick_${categoryId}_${state.currentSelectIdx}`)
    .setPlaceholder(String(q.label || 'Vælg...').substring(0, 100))
    .setMinValues(minValues)
    .setMaxValues(maxValues)
    .addOptions(
      q.options.slice(0, 25).map((opt, i) => ({
        label: String(opt).substring(0, 100),
        value: `opt_${i}`,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);
  const content = `**${q.label}** ${q.multi ? '_(vælg en eller flere)_' : ''}\n_Trin ${state.currentSelectIdx + 1} af ${state.selectQuestions.length}_`;

  if (firstTime) {
    // Initial response to the triggering button/select
    if (interaction.isStringSelectMenu?.() && !interaction.deferred && !interaction.replied) {
      return interaction.update({ content, components: [row] });
    }
    if (!interaction.deferred && !interaction.replied) {
      return interaction.reply({ content, components: [row], ephemeral: true });
    }
    return interaction.editReply({ content, components: [row] });
  }

  // Called from a pick-submit interaction — update the ephemeral message
  return interaction.update({ content, components: [row] });
}

async function handlePickSubmit(interaction) {
  // custom_id: ticket_pick_<categoryId>_<idx>
  const rest = interaction.customId.replace('ticket_pick_', '');
  const lastUnderscore = rest.lastIndexOf('_');
  const categoryId = rest.slice(0, lastUnderscore);
  const idx = parseInt(rest.slice(lastUnderscore + 1), 10);

  const state = getFlow(interaction.user.id, categoryId);
  if (!state || state.currentSelectIdx !== idx) {
    return interaction.update({
      content: '⚠️ Denne session er ikke længere aktiv. Start venligst forfra.',
      components: [],
    }).catch(() => {});
  }

  const q = state.selectQuestions[idx];
  const picks = (interaction.values || []).map((v) => {
    const optIdx = parseInt(String(v).replace('opt_', ''), 10);
    return q.options[optIdx];
  }).filter(Boolean);

  state.selectAnswers.push({
    question: q.label || `Spørgsmål ${idx + 1}`,
    answer: picks.length > 0 ? picks.join(', ') : '(Intet valgt)',
  });
  state.currentSelectIdx = idx + 1;
  setFlow(interaction.user.id, categoryId, state);

  // More select questions?
  if (state.currentSelectIdx < state.selectQuestions.length) {
    return askNextSelect(interaction, categoryId, false);
  }

  // All selects done. Text questions next?
  if (state.textQuestions.length > 0) {
    // showModal must be the initial response and cannot follow an update.
    // Since we haven't deferred/updated yet on this interaction, show modal directly.
    return showTextModal(interaction, state.category, state.textQuestions);
  }

  // No text questions — create ticket now
  await interaction.update({ content: '⏳ Opretter ticket...', components: [] });
  const answers = [...state.selectAnswers];
  clearFlow(interaction.user.id, categoryId);
  await handleCreateTicket(interaction, categoryId, answers, state.category, state.settings);
}

async function handleTicketModalSubmit(interaction) {
  const categoryId = interaction.customId.replace('ticket_modal_', '');
  await interaction.deferReply({ ephemeral: true });

  const state = getFlow(interaction.user.id, categoryId);
  const category = state?.category || (await callAPI('getCategory', { categoryId })).category;
  if (!category) {
    return interaction.editReply({ content: '❌ Kategori ikke fundet.' });
  }

  const textQuestions = state?.textQuestions || (Array.isArray(category.questions) ? category.questions.filter((q) => q.style !== 'select') : []);
  const textAnswers = textQuestions.slice(0, 5).map((q, index) => {
    let value = '';
    try { value = interaction.fields.getTextInputValue(`question_${index}`); } catch { /* missing */ }
    return {
      question: q.label || `Spørgsmål ${index + 1}`,
      answer: value || '(Intet svar)',
    };
  });

  const combined = [...(state?.selectAnswers || []), ...textAnswers];
  const settings = state?.settings;
  clearFlow(interaction.user.id, categoryId);
  await handleCreateTicket(interaction, categoryId, combined, category, settings);
}

async function handleCreateTicket(interaction, categoryId, applicationAnswers, presetCategory, presetSettings) {
  // If we're already deferred/updated (button flow or modal), don't defer again
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const category = presetCategory || (await callAPI('getCategory', { categoryId })).category;

  if (!category) {
    return interaction.editReply({ content: '❌ Kategori ikke fundet.' });
  }

  const settings = presetSettings || (await callAPI('getSettings', { guildId: category.guild_id })).settings;

  // Get parent channel
  const parentChannel = settings?.thread_category_id
    ? await interaction.guild.channels.fetch(settings.thread_category_id).catch(() => null)
    : interaction.channel;

  // Create thread
  const ticketNumber = Date.now().toString(36).toUpperCase();
  const thread = await parentChannel.threads.create({
    name: `${category.emoji || '🎫'} ${category.name}-${ticketNumber}`.substring(0, 100),
    type: ChannelType.PrivateThread,
    invitable: false
  });

  // Add creator to thread
  await thread.members.add(interaction.user.id);

  if (category.staff_role_id) {
    try {
      const pingMsg = await thread.send({
        content: `<@&${category.staff_role_id}>`,
        allowedMentions: { roles: [category.staff_role_id] }
      });
      setTimeout(() => { pingMsg.delete().catch(() => {}); }, 1500);
    } catch (error) {
      console.error('Failed to notify staff role:', error);
    }
  }

  // Create embed
  let description = category.welcome_message || 'Tak for din henvendelse!';
  const isApplication = category.ticket_type === 'application';
  if (Array.isArray(applicationAnswers) && applicationAnswers.length > 0) {
    const header = isApplication ? '**Ansøgning modtaget!**' : '**Oplysninger fra bruger:**';
    description = `${header}\n\n`;
    for (const qa of applicationAnswers) {
      description += `**${qa.question}**\n${qa.answer}\n\n`;
    }
    description += `---\n${category.welcome_message || ''}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${category.emoji || '🎫'} ${category.name}`)
    .setDescription(description)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Oprettet af', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Status', value: '🟢 Åben', inline: true }
    )
    .setFooter({ text: `Ticket ID: ${ticketNumber}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${thread.id}`).setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
    new ButtonBuilder().setCustomId(`ticket_close_${thread.id}`).setLabel('Close (Archive)').setStyle(ButtonStyle.Secondary).setEmoji('📁'),
    new ButtonBuilder().setCustomId(`ticket_delete_${thread.id}`).setLabel('Close (Delete)').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );

  await thread.send({ embeds: [embed], components: [row] });

  // Save to database via API
  await callAPI('createTicket', {
    guildId: category.guild_id,
    categoryId,
    channelId: thread.id,
    creatorId: interaction.user.id,
    creatorName: interaction.user.username,
    ticketType: category.ticket_type,
    applicationType: category.name,
    answers: applicationAnswers || [],
  });

  await interaction.editReply({ content: `✅ Ticket oprettet: <#${thread.id}>`, components: [] });
}


async function handleClaimTicket(interaction, threadId) {
  await callAPI('claimTicket', {
    channelId: threadId,
    claimedById: interaction.user.id,
    claimedByName: interaction.user.username
  });

  // For button interactions, update the original message embed
  if (interaction.isButton?.() && interaction.message?.embeds?.[0]) {
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFields(interaction.message.embeds[0].fields.map(f => 
        f.name === 'Status' ? { name: 'Status', value: `🟡 Claimed af <@${interaction.user.id}>`, inline: true } : f
      ));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('disabled').setLabel(`Claimed af ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setEmoji('🙋').setDisabled(true),
      new ButtonBuilder().setCustomId(`ticket_close_${threadId}`).setLabel('Close (Archive)').setStyle(ButtonStyle.Secondary).setEmoji('📁'),
      new ButtonBuilder().setCustomId(`ticket_delete_${threadId}`).setLabel('Close (Delete)').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    // Slash command - just reply
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `✅ Ticket claimed af <@${interaction.user.id}>`, ephemeral: true });
    } else {
      await interaction.editReply({ content: `✅ Ticket claimed af <@${interaction.user.id}>` });
    }
  }
}

async function handleCloseTicket(interaction, threadId, deleteThread = false) {
  const result = await callAPI('closeTicket', {
    channelId: threadId,
    closedById: interaction.user.id,
    closedByName: interaction.user.username
  });

  // Trigger AI summary asynchronously (fire-and-forget)
  if (result?.ticket_id) {
    const SUMMARY_URL = '${APP_API_BASE}/api/public/ai-ticket-summary';
    fetch(SUMMARY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
      body: JSON.stringify({ action: 'summarize', data: { ticket_id: result.ticket_id } })
    }).catch(err => console.error('[Tickets] AI summary error:', err.message));

    // Trigger HTML transcript generation + DM (fire-and-forget)
    const TRANSCRIPT_URL = '${APP_API_BASE}/api/public/generate-ticket-transcript';
    fetch(TRANSCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
      body: JSON.stringify({ ticket_id: result.ticket_id })
    }).catch(err => console.error('[Tickets] Transcript error:', err.message));
  }

  // For button interactions, update the original message embed
  if (interaction.isButton?.() && interaction.message?.embeds?.[0]) {
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xED4245)
      .setFields(interaction.message.embeds[0].fields.map(f => 
        f.name === 'Status' ? { name: 'Status', value: `🔴 Lukket af <@${interaction.user.id}>`, inline: true } : f
      ));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('disabled').setLabel('Ticket Lukket').setStyle(ButtonStyle.Secondary).setEmoji('🔒').setDisabled(true)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    // Slash command - reply
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `🔒 Ticket lukket af <@${interaction.user.id}>`, ephemeral: true });
    } else {
      await interaction.editReply({ content: `🔒 Ticket lukket af <@${interaction.user.id}>` });
    }
  }

  if (interaction.channel?.isThread()) {
    if (deleteThread) {
      await interaction.channel.delete().catch(async (err) => {
        console.error('Failed to delete thread, falling back to archive:', err.message);
        await interaction.channel.setArchived(true).catch(console.error);
        await interaction.channel.setLocked(true).catch(console.error);
      });
    } else {
      await interaction.channel.setArchived(true).catch(console.error);
      await interaction.channel.setLocked(true).catch(console.error);
    }
  }
}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

async function handleTicketRemind(interaction, remindTimers) {
  // Must be used inside a thread
  if (!interaction.channel?.isThread()) {
    return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', ephemeral: true });
  }

  // Check if already reminded
  if (remindTimers.has(interaction.channel.id)) {
    return interaction.reply({ content: '⚠️ Der er allerede sendt en påmindelse for denne ticket.', ephemeral: true });
  }

  // Get ticket info from API to find the creator
  let ticket;
  try {
    const result = await callAPI('getTicket', { channelId: interaction.channel.id });
    ticket = result?.ticket;
  } catch {
    return interaction.reply({ content: '❌ Kunne ikke finde ticket-info for denne tråd.', ephemeral: true });
  }

  if (!ticket) {
    return interaction.reply({ content: '❌ Denne tråd er ikke en aktiv ticket.', ephemeral: true });
  }

  const creatorId = ticket.creator_discord_id || ticket.creatorId;
  if (!creatorId) {
    return interaction.reply({ content: '❌ Kunne ikke finde ticket-ejeren.', ephemeral: true });
  }

  // Send reminder ping
  const reminderEmbed = new EmbedBuilder()
    .setTitle('⏰ Ticket Påmindelse')
    .setDescription(`<@${creatorId}>, du har en åben ticket der venter på dit svar!\n\n⚠️ **Hvis du ikke svarer inden 12 timer, lukkes denne ticket automatisk.**`)
    .setColor(0xFFA500)
    .setTimestamp();

  await interaction.reply({ content: `<@${creatorId}>`, embeds: [reminderEmbed] });

  // Set 12-hour auto-delete timer
  const timeout = setTimeout(async () => {
    try {
      remindTimers.delete(interaction.channel.id);
      
      // Close the ticket via API
      await callAPI('closeTicket', {
        channelId: interaction.channel.id,
        closedById: interaction.client.user.id,
        closedByName: 'Auto-lukning (ingen svar)',
      });

      // Send closing message
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Auto-Lukket')
        .setDescription('Denne ticket er automatisk blevet lukket da der ikke blev svaret inden for 12 timer efter påmindelsen.')
        .setColor(0xED4245)
        .setTimestamp();

      await interaction.channel.send({ embeds: [closeEmbed] }).catch(() => {});

      // Archive and lock the thread
      await interaction.channel.setArchived(true).catch(() => {});
      await interaction.channel.setLocked(true).catch(() => {});

      console.log(`[Tickets] Auto-closed ticket ${interaction.channel.id} — no response after remind`);
    } catch (err) {
      console.error('[Tickets] Auto-close error:', err.message);
    }
  }, TWELVE_HOURS);

  remindTimers.set(interaction.channel.id, { timeout, creatorId });
  console.log(`[Tickets] Remind sent for ${interaction.channel.id}, auto-delete in 12h`);
}


async function handleRateTicket(interaction) {
  // ticket_rate_<ticketUuid>_<n>
  const raw = interaction.customId.replace('ticket_rate_', '');
  const lastUnderscore = raw.lastIndexOf('_');
  if (lastUnderscore < 0) return;
  const ticketId = raw.slice(0, lastUnderscore);
  const rating = parseInt(raw.slice(lastUnderscore + 1), 10);
  if (!ticketId || !rating || rating < 1 || rating > 5) return;

  const RATE_URL = '${APP_API_BASE}/api/public/submit-ticket-rating';
  const resp = await fetch(RATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
    body: JSON.stringify({
      ticket_id: ticketId,
      rated_by_id: interaction.user.id,
      rating,
    }),
  });

  if (!resp.ok) {
    return interaction.reply({ content: '❌ Kunne ikke gemme rating.', ephemeral: true });
  }

  // Update the DM message to confirm and disable buttons
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const disabled = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map(n =>
      new ButtonBuilder().setCustomId(`disabled_${n}`).setLabel(`${n} ★`).setStyle(ButtonStyle.Secondary).setDisabled(true)
    )
  );
  await interaction.update({
    content: `✅ Tak for din rating: **${stars}** (${rating}/5)`,
    embeds: interaction.message?.embeds || [],
    components: [disabled],
  }).catch(() => {});
}

module.exports = { setupTicketHandler };
