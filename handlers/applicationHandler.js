/**
 * Application Handler for Discord Bot
 * 
 * Handles application submissions via slash commands and button panels.
 * Uses direct Supabase queries instead of HTTP calls for fast modal opening.
 * 
 * Usage:
 * const { setupApplicationHandler } = require('./applicationHandler');
 * setupApplicationHandler(client, { shouldHandleGuild, supabase });
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Simple TTL cache for application forms (60 second TTL)
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

/**
 * Fetch form directly from database (fast, no HTTP round-trip)
 */
async function getFormFromDB(supabase, formId) {
  // Check cache first
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

/**
 * Submit application via Edge Function (keeps DM/log logic server-side)
 */
async function callApplicationAPI(action, data) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/application-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET_KEY
    },
    body: JSON.stringify({ action, ...data })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

/**
 * Show the application modal for a given form
 */
async function showApplicationModal(interaction, formId, supabase) {
  try {
    // Fetch form from DB directly (fast, cached)
    const form = await getFormFromDB(supabase, formId);

    if (!form) {
      return interaction.reply({ content: 'Application form not found or disabled.', ephemeral: true });
    }

    const questions = Array.isArray(form.questions) ? form.questions : [];
    if (questions.length === 0) {
      return interaction.reply({ content: 'This form has no questions configured.', ephemeral: true });
    }

    // Create modal with questions (max 5 per Discord limit)
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId(`application_form_${formId}`)
      .setTitle(`${form.emoji || '📝'} ${form.name}`.substring(0, 45));

    const modalQuestions = questions.slice(0, 5);
    
    for (const question of modalQuestions) {
      const input = new TextInputBuilder()
        .setCustomId(String(question.id || 'question').substring(0, 100))
        .setLabel(String(question.label || 'Question').substring(0, 45))
        .setStyle(question.type === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(question.required !== false);

      const placeholder = typeof question.placeholder === 'string'
        ? question.placeholder.substring(0, 100)
        : '';

      if (placeholder) {
        input.setPlaceholder(placeholder);
      }

      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
    console.log(`[Applications] Modal shown for form ${formId} in guild ${interaction.guild?.id}`);
  } catch (error) {
    console.error('[Applications] Modal open error:', error);
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply({ content: 'Failed to open application form.', ephemeral: true }).catch(() => {});
  }
}

/**
 * Setup application handler on Discord client
 * @param {Client} client - Discord.js client
 * @param {Object} config - Configuration object with shouldHandleGuild function and supabase client
 */
function setupApplicationHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);
  const supabase = config.supabase;

  if (!supabase) {
    console.warn('[Applications] No Supabase client provided – handler will use HTTP fallback (slower)');
  }

  // Handle button interactions for application panel
  client.on('interactionCreate', async (interaction) => {
    // Handle button clicks: application_start_<formId> or legacy apply_<formId>
    if (interaction.isButton()) {
      let formId = null;

      if (interaction.customId.startsWith('application_start_')) {
        formId = interaction.customId.replace('application_start_', '');
      } else if (interaction.customId.startsWith('apply_')) {
        formId = interaction.customId.replace('apply_', '');
      }

      if (!formId) return;
      if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;

      return showApplicationModal(interaction, formId, supabase);
    }

    // Handle dropdown select: application_select
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      if (interaction.customId !== 'application_select') return;
      if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;

      const formId = interaction.values?.[0];
      if (!formId) return;

      return showApplicationModal(interaction, formId, supabase);
    }
  });

  // Handle modal submissions
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('application_form_') && !interaction.customId.startsWith('application_')) return;
    // Skip approve/deny modals
    if (interaction.customId.startsWith('application_approve_') || interaction.customId.startsWith('application_deny_')) return;

    // Check if this bot instance should handle this guild
    if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;

    // Extract formId from either format
    let formId;
    if (interaction.customId.startsWith('application_form_')) {
      formId = interaction.customId.replace('application_form_', '');
    } else {
      formId = interaction.customId.replace('application_', '');
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      console.log(`[Applications] Submit started for form ${formId} by ${interaction.user.username}`);

      // Collect answers
      const answers = [];
      interaction.fields.fields.forEach((field, key) => {
        answers.push({
          questionId: key,
          answer: field.value
        });
      });

      // Submit application via Edge Function (handles DMs, logs, role grants)
      const result = await callApplicationAPI('submit', {
        form_id: formId,
        guild_id: interaction.guild.id,
        user_id: interaction.user.id,
        username: interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ size: 128 }),
        answers
      });

      if (result.success) {
        console.log(`[Applications] Submit success for form ${formId} by ${interaction.user.username}`);
        await interaction.editReply({ content: '✅ Your application has been submitted!' });
      } else {
        console.warn(`[Applications] Submit returned error: ${result.message}`);
        await interaction.editReply({ content: result.message || 'Failed to submit application.' });
      }
    } catch (error) {
      console.error('[Applications] Submit error:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while submitting your application.' }).catch(() => {});
      }
    }
  });

  console.log('✅ Application handler initialized (direct DB mode)');
}

module.exports = { setupApplicationHandler };
