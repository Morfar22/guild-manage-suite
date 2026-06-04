/**
 * Application Handler for Discord Bot (DM Session Mode)
 *
 * Flow:
 *  1. User clicks button / picks dropdown → bot replies ephemeral "check your DMs"
 *  2. Bot opens a DM and asks questions ONE AT A TIME
 *  3. User answers each question with a normal DM message (no 5-question limit)
 *  4. Supports commands inside DM: `cancel`, `skip` (optional questions), `back`
 *  5. After the last question, bot shows a summary with Confirm / Edit / Cancel buttons
 *  6. Confirm → submits via the application-handler edge function
 *
 * Requires intents: Guilds, GuildMessages, DirectMessages, MessageContent
 * + Channel partial so DM messages fire messageCreate.
 *
 * Usage:
 *   const { setupApplicationHandler } = require('./applicationHandler');
 *   setupApplicationHandler(client, { shouldHandleGuild, supabase });
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// ----- Form cache (60s TTL) -----
const formCache = new Map();
const CACHE_TTL = 60_000;

function getCachedForm(formId) {
  const entry = formCache.get(formId);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  formCache.delete(formId);
  return null;
}

function setCachedForm(formId, data) {
  formCache.set(formId, { data, ts: Date.now() });
}

async function getFormFromDB(supabase, formId) {
  const cached = getCachedForm(formId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('application_forms')
    .select('id, name, emoji, questions, enabled')
    .eq('id', formId)
    .eq('enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[Applications] DB query error:', error.message);
    return null;
  }
  if (data) setCachedForm(formId, data);
  return data;
}

// ----- Active DM sessions (keyed by Discord user id) -----
// session = { userId, guildId, guildDbId?, formId, form, questions, index, answers, lastActivity, timer }
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle timeout

function endSession(userId, reason) {
  const s = sessions.get(userId);
  if (!s) return;
  if (s.timer) clearTimeout(s.timer);
  sessions.delete(userId);
  if (reason) console.log(`[Applications] Session ended for ${userId}: ${reason}`);
}

function refreshSessionTimer(userId) {
  const s = sessions.get(userId);
  if (!s) return;
  if (s.timer) clearTimeout(s.timer);
  s.lastActivity = Date.now();
  s.timer = setTimeout(async () => {
    const stale = sessions.get(userId);
    if (!stale) return;
    try {
      const user = stale.user;
      if (user) {
        await user.send('⏰ Your application timed out due to inactivity. Start over by clicking the panel again.').catch(() => {});
      }
    } catch (_) {}
    endSession(userId, 'timeout');
  }, SESSION_TTL_MS);
}

// ----- Edge function call -----
async function callApplicationAPI(action, data) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/application-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET_KEY,
    },
    body: JSON.stringify({ action, ...data }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}

// ----- Question rendering -----
function buildQuestionEmbed(form, question, index, total) {
  const { EmbedBuilder } = require('discord.js');
  const requiredTag = question.required === false ? ' *(optional — type `skip`)*' : '';
  const desc = [
    `**${question.label || `Question ${index + 1}`}**${requiredTag}`,
  ];
  if (question.placeholder) desc.push(`*${question.placeholder}*`);
  if (question.type === 'select' && Array.isArray(question.options) && question.options.length) {
    desc.push('');
    desc.push('Choose one of:');
    question.options.forEach((opt, i) => desc.push(`\`${i + 1}.\` ${opt}`));
    desc.push('');
    desc.push('Reply with the **number** or the **exact option text**.');
  } else if (question.type === 'long') {
    desc.push('');
    desc.push('_You can write a long answer. Send when done._');
  }
  desc.push('');
  desc.push('— Type `back` to edit the previous answer · `cancel` to abort.');

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${form.emoji || '📝'} ${form.name} — Question ${index + 1}/${total}`)
    .setDescription(desc.join('\n'))
    .setFooter({ text: 'Reply directly in this DM with your answer.' });
}

async function askCurrentQuestion(session) {
  const { user, form, questions, index } = session;
  const embed = buildQuestionEmbed(form, questions[index], index, questions.length);
  await user.send({ embeds: [embed] });
  refreshSessionTimer(session.userId);
}

function buildSummaryPayload(session) {
  const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
  const { form, questions, answers } = session;
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`📋 Review your ${form.name} application`)
    .setDescription('Please review your answers before submitting.');

  questions.forEach((q, i) => {
    const ans = answers[i]?.answer ?? '*(skipped)*';
    embed.addFields({
      name: `${i + 1}. ${(q.label || `Question ${i + 1}`).substring(0, 256)}`,
      value: String(ans).substring(0, 1024) || '*(empty)*',
    });
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('appdm_confirm').setStyle(ButtonStyle.Success).setLabel('Submit'),
    new ButtonBuilder().setCustomId('appdm_edit').setStyle(ButtonStyle.Secondary).setLabel('Edit answer'),
    new ButtonBuilder().setCustomId('appdm_cancel').setStyle(ButtonStyle.Danger).setLabel('Cancel'),
  );

  return { embeds: [embed], components: [row] };
}

function buildEditPickerPayload(session) {
  const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Edit an answer')
    .setDescription('Pick the question you want to change.');

  const options = session.questions.slice(0, 25).map((q, i) => ({
    label: `${i + 1}. ${(q.label || `Question ${i + 1}`).substring(0, 90)}`,
    value: String(i),
    description: (session.answers[i]?.answer || '(no answer)').toString().substring(0, 95),
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('appdm_editpick')
    .setPlaceholder('Select a question to re-answer')
    .addOptions(options);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ----- Start a DM session -----
async function startDmSession(interaction, formId, supabase) {
  const form = await getFormFromDB(supabase, formId);
  if (!form) {
    return interaction.reply({ content: 'Application form not found or disabled.', ephemeral: true });
  }
  const questions = Array.isArray(form.questions) ? form.questions : [];
  if (questions.length === 0) {
    return interaction.reply({ content: 'This form has no questions configured.', ephemeral: true });
  }

  // Block if user already has an active session
  if (sessions.has(interaction.user.id)) {
    return interaction.reply({
      content: '⚠️ You already have an application in progress. Check your DMs (or type `cancel` there to abort).',
      ephemeral: true,
    });
  }

  // Try to open DM first so we can fail fast
  let dm;
  try {
    dm = await interaction.user.createDM();
  } catch (_) {
    return interaction.reply({
      content: '❌ I could not DM you. Please enable DMs from server members and try again.',
      ephemeral: true,
    });
  }

  const session = {
    userId: interaction.user.id,
    user: interaction.user,
    guildDiscordId: interaction.guild.id,
    formId: form.id,
    form,
    questions,
    index: 0,
    answers: new Array(questions.length).fill(null),
    dmChannelId: dm.id,
    awaitingEditPick: false,
    timer: null,
    lastActivity: Date.now(),
  };
  sessions.set(interaction.user.id, session);
  refreshSessionTimer(interaction.user.id);

  try {
    const { EmbedBuilder } = require('discord.js');
    const intro = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`${form.emoji || '📝'} ${form.name}`)
      .setDescription(
        [
          `You're applying with **${questions.length} question${questions.length === 1 ? '' : 's'}**.`,
          'I will ask them one at a time — just reply normally.',
          '',
          '• `cancel` — abort the application',
          '• `back` — change your previous answer',
          '• `skip` — skip an optional question',
        ].join('\n'),
      );
    await interaction.user.send({ embeds: [intro] });
    await askCurrentQuestion(session);
    await interaction.reply({ content: '📬 Check your DMs to continue your application!', ephemeral: true });
  } catch (err) {
    console.error('[Applications] Failed to start DM flow:', err);
    endSession(interaction.user.id, 'start-failed');
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ I could not DM you. Please enable DMs from server members and try again.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
}

// ----- Validate / normalize an answer for the current question -----
function validateAnswer(question, rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    if (question.required === false) return { ok: true, value: '' };
    return { ok: false, error: 'This question is required. Please send an answer.' };
  }
  if (question.type === 'select' && Array.isArray(question.options) && question.options.length) {
    const asNum = parseInt(text, 10);
    if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= question.options.length) {
      return { ok: true, value: question.options[asNum - 1] };
    }
    const match = question.options.find((o) => String(o).toLowerCase() === text.toLowerCase());
    if (match) return { ok: true, value: match };
    return {
      ok: false,
      error: `Please reply with a number 1–${question.options.length} or the exact option text.`,
    };
  }
  if (text.length > 1900) {
    return { ok: false, error: 'Answer is too long (max 1900 characters). Please shorten it.' };
  }
  return { ok: true, value: text };
}

// ----- Submit the completed session -----
async function submitSession(session, interactionOrMessage) {
  try {
    const result = await callApplicationAPI('submit', {
      form_id: session.formId,
      guild_id: session.guildDiscordId,
      user_id: session.userId,
      username: session.user.username,
      avatar: session.user.displayAvatarURL({ size: 128 }),
      answers: session.questions.map((q, i) => ({
        questionId: q.id || `q_${i}`,
        questionLabel: q.label || `Question ${i + 1}`,
        answer: session.answers[i]?.answer ?? '',
      })),
    });

    if (result?.success) {
      await session.user.send('✅ Your application has been submitted and is awaiting review. Thank you!');
      console.log(`[Applications] Submitted form ${session.formId} by ${session.user.username}`);
    } else {
      await session.user.send(`❌ Submission failed: ${result?.message || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('[Applications] Submit error:', err);
    await session.user.send('❌ An error occurred while submitting your application. Please try again later.').catch(() => {});
  } finally {
    endSession(session.userId, 'submitted');
  }
}

// ============= MAIN SETUP =============
function setupApplicationHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);
  const supabase = config.supabase;

  if (!supabase) {
    console.warn('[Applications] No Supabase client provided.');
  }

  // ----- Interactions (panel buttons + dropdown + review buttons) -----
  client.on('interactionCreate', async (interaction) => {
    try {
      // Panel buttons
      if (interaction.isButton()) {
        const id = interaction.customId;

        // Start flow
        if (id.startsWith('application_start_') || id.startsWith('apply_')) {
          if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;
          const formId = id.replace(/^application_start_|^apply_/, '');
          return startDmSession(interaction, formId, supabase);
        }

        // DM review buttons
        if (['appdm_confirm', 'appdm_edit', 'appdm_cancel'].includes(id)) {
          const session = sessions.get(interaction.user.id);
          if (!session) {
            return interaction.reply({ content: 'No active application session.', ephemeral: true });
          }
          if (id === 'appdm_cancel') {
            await interaction.update({ content: '❌ Application cancelled.', embeds: [], components: [] }).catch(() => {});
            endSession(session.userId, 'user-cancelled');
            return;
          }
          if (id === 'appdm_edit') {
            session.awaitingEditPick = true;
            const payload = buildEditPickerPayload(session);
            await interaction.update(payload).catch(() => {});
            return;
          }
          if (id === 'appdm_confirm') {
            await interaction.update({ content: '⏳ Submitting…', embeds: [], components: [] }).catch(() => {});
            return submitSession(session, interaction);
          }
        }
        return;
      }

      // Dropdown — panel select OR edit picker in DM
      if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
        if (interaction.customId === 'application_select') {
          if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;
          const formId = interaction.values?.[0];
          if (!formId) return;
          return startDmSession(interaction, formId, supabase);
        }

        if (interaction.customId === 'appdm_editpick') {
          const session = sessions.get(interaction.user.id);
          if (!session) {
            return interaction.reply({ content: 'No active application session.', ephemeral: true });
          }
          const idx = parseInt(interaction.values?.[0] ?? '-1', 10);
          if (Number.isNaN(idx) || idx < 0 || idx >= session.questions.length) {
            return interaction.reply({ content: 'Invalid selection.', ephemeral: true });
          }
          session.index = idx;
          session.awaitingEditPick = false;
          await interaction.update({ content: `✏️ Re-answer question ${idx + 1}:`, embeds: [], components: [] }).catch(() => {});
          await askCurrentQuestion(session);
          return;
        }
      }
    } catch (err) {
      console.error('[Applications] interactionCreate error:', err);
    }
  });

  // ----- DM messages = answers -----
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return; // only DMs
      const session = sessions.get(message.author.id);
      if (!session) return;
      if (session.awaitingEditPick) {
        await message.reply('Please pick a question from the menu above first.').catch(() => {});
        return;
      }

      refreshSessionTimer(session.userId);
      const raw = message.content || '';
      const lower = raw.trim().toLowerCase();

      if (lower === 'cancel') {
        await message.reply('❌ Application cancelled.').catch(() => {});
        endSession(session.userId, 'user-cancelled');
        return;
      }

      if (lower === 'back') {
        if (session.index === 0) {
          await message.reply('You are already on the first question.').catch(() => {});
          return;
        }
        session.index -= 1;
        await message.reply('⏪ Going back to the previous question.').catch(() => {});
        await askCurrentQuestion(session);
        return;
      }

      const question = session.questions[session.index];

      if (lower === 'skip') {
        if (question.required !== false) {
          await message.reply('This question is required — please answer it.').catch(() => {});
          return;
        }
        session.answers[session.index] = { questionId: question.id, answer: '' };
        session.index += 1;
      } else {
        const { ok, value, error } = validateAnswer(question, raw);
        if (!ok) {
          await message.reply(`⚠️ ${error}`).catch(() => {});
          return;
        }
        session.answers[session.index] = { questionId: question.id, answer: value };
        session.index += 1;
      }

      // More questions left?
      if (session.index < session.questions.length) {
        await askCurrentQuestion(session);
        return;
      }

      // Finished → show summary
      const payload = buildSummaryPayload(session);
      await message.author.send(payload).catch(async (e) => {
        console.error('[Applications] Failed to send summary:', e);
      });
    } catch (err) {
      console.error('[Applications] messageCreate error:', err);
    }
  });

  console.log('✅ Application handler initialized (DM session mode)');
}

module.exports = { setupApplicationHandler };
