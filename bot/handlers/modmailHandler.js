// Modmail Handler - DM-based staff communication
// Now uses Edge Function for database operations (no service role key needed on bot)
const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Global set to track DMs being processed (prevents duplicate processing across bot instances)
const processingDMs = new Set();
// Global set to track recently processed DMs with content hash
const recentlyProcessedDMs = new Map();
const DM_DEDUP_WINDOW_MS = 5000; // 5 second window for deduplication

class ModmailHandler {
  constructor(client, supabaseUrl, botSecretKey, config = {}) {
    this.client = client;
    this.supabaseUrl = supabaseUrl;
    this.botSecretKey = botSecretKey;
    this.shouldHandleGuild = config.shouldHandleGuild || (() => true);
    
    // Validate required dependencies
    if (!this.supabaseUrl) {
      console.error('[Modmail] WARNING: Supabase URL is not provided! Modmail will not function correctly.');
    }
    if (!this.botSecretKey) {
      console.error('[Modmail] WARNING: Bot secret key is not provided! Modmail will not function correctly.');
    }
    if (!this.client) {
      console.error('[Modmail] WARNING: Discord client is not provided! Modmail will not function correctly.');
    }
  }

  // Helper method to call the edge function
  async callEdgeFunction(action, params = {}) {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/modmail-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': this.botSecretKey,
        },
        body: JSON.stringify({ action, ...params }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[Modmail] Edge function error for ${action}:`, data.error);
        return { error: data.error, status: response.status };
      }

      return data;
    } catch (error) {
      console.error(`[Modmail] Failed to call edge function for ${action}:`, error);
      return { error: error.message };
    }
  }

  async init() {
    this.client.on('messageCreate', (message) => this.handleMessage(message));
    this.client.on('interactionCreate', (interaction) => {
      if (!interaction.guild || this.shouldHandleGuild(interaction.guild.id)) {
        this.handleInteraction(interaction);
      }
    });
    console.log('[Modmail] Handler initialized (using edge function for DB operations)');
  }

  // Create a unique hash for a DM message to detect duplicates
  createDMHash(message) {
    return `${message.author.id}:${message.id}`;
  }

  // Check if a DM is already being processed or was recently processed
  isDuplicateDM(message) {
    const hash = this.createDMHash(message);
    
    // Check if currently being processed
    if (processingDMs.has(hash)) {
      console.log(`[Modmail] Skipping duplicate DM (in progress): ${hash}`);
      return true;
    }
    
    // Check if recently processed
    const processedTime = recentlyProcessedDMs.get(hash);
    if (processedTime && (Date.now() - processedTime) < DM_DEDUP_WINDOW_MS) {
      console.log(`[Modmail] Skipping duplicate DM (recently processed): ${hash}`);
      return true;
    }
    
    return false;
  }

  // Mark a DM as being processed
  markDMProcessing(message) {
    const hash = this.createDMHash(message);
    processingDMs.add(hash);
  }

  // Mark a DM as processed and clean up
  markDMProcessed(message) {
    const hash = this.createDMHash(message);
    processingDMs.delete(hash);
    recentlyProcessedDMs.set(hash, Date.now());
    
    // Cleanup old entries
    const now = Date.now();
    for (const [key, time] of recentlyProcessedDMs) {
      if (now - time > DM_DEDUP_WINDOW_MS * 2) {
        recentlyProcessedDMs.delete(key);
      }
    }
  }

  // Mark processing as failed
  markDMFailed(message) {
    const hash = this.createDMHash(message);
    processingDMs.delete(hash);
  }

  async handleMessage(message) {
    // Handle DMs to the bot
    if (message.author.bot) return;

    if (!message.guild) {
      // This is a DM
      await this.handleDM(message);
    } else {
      // IMPORTANT: Prevent duplicate handling across multi-bot instances
      if (!this.shouldHandleGuild(message.guild.id)) return;
      
      // Check for duplicate staff reply processing
      if (this.isDuplicateStaffReply(message)) return;
      
      // Check if this is a modmail channel
      await this.handleStaffReply(message);
    }
  }

  // Check if staff reply is already being processed
  isDuplicateStaffReply(message) {
    const hash = `staff:${message.id}`;
    
    if (processingDMs.has(hash)) {
      console.log(`[Modmail] Skipping duplicate staff reply (in progress): ${hash}`);
      return true;
    }
    
    const processedTime = recentlyProcessedDMs.get(hash);
    if (processedTime && (Date.now() - processedTime) < DM_DEDUP_WINDOW_MS) {
      console.log(`[Modmail] Skipping duplicate staff reply (recently processed): ${hash}`);
      return true;
    }
    
    // Mark as processing
    processingDMs.add(hash);
    return false;
  }

  // Mark staff reply as processed
  markStaffReplyProcessed(messageId) {
    const hash = `staff:${messageId}`;
    processingDMs.delete(hash);
    recentlyProcessedDMs.set(hash, Date.now());
  }

  // Mark staff reply as failed
  markStaffReplyFailed(messageId) {
    const hash = `staff:${messageId}`;
    processingDMs.delete(hash);
  }

  async handleDM(message) {
    // Check for duplicate DM processing FIRST
    if (this.isDuplicateDM(message)) {
      return;
    }
    
    // Mark as being processed
    this.markDMProcessing(message);
    
    try {
      // Validate edge function is available
      if (!this.supabaseUrl || !this.botSecretKey) {
        console.error('[Modmail] Edge function not configured - cannot process modmail');
        await message.reply('Modmail er ikke korrekt konfigureret. Kontakt en administrator.');
        this.markDMFailed(message);
        return;
      }

      // Find which guild the user wants to contact
      // Check ALL guilds the bot is in and verify membership via API (not just cache)
      let targetGuild = null;
      let settings = null;

      for (const [, guild] of this.client.guilds.cache) {
        // Check if this guild should be handled by this bot instance
        if (!this.shouldHandleGuild(guild.id)) {
          console.log(`[Modmail] Skipping guild ${guild.name} - not handled by this bot instance`);
          continue;
        }

        // Fetch member from API to ensure we have accurate membership info
        let isMember = false;
        try {
          const member = await guild.members.fetch(message.author.id);
          isMember = !!member;
          console.log(`[Modmail] User ${message.author.username} is member of ${guild.name}: ${isMember}`);
        } catch (e) {
          // User is not in this guild
          console.log(`[Modmail] User ${message.author.username} is NOT member of ${guild.name}`);
          isMember = false;
        }

        if (!isMember) continue;

        // Use edge function to get guild from DB
        const guildResult = await this.callEdgeFunction('getGuildByDiscordId', {
          discordGuildId: guild.id
        });

        if (guildResult.error) {
          console.log(`[Modmail] Error fetching guild from DB for ${guild.name}:`, guildResult.error);
          continue;
        }

        if (!guildResult.data) {
          console.log(`[Modmail] Guild ${guild.name} (${guild.id}) not found in database`);
          continue;
        }

        const dbGuild = guildResult.data;
        console.log(`[Modmail] Found guild in DB: ${guild.name}, DB ID: ${dbGuild.id}`);

        // Use edge function to get modmail settings
        const settingsResult = await this.callEdgeFunction('getModmailSettings', {
          guildDbId: dbGuild.id
        });

        if (settingsResult.error) {
          console.log(`[Modmail] Error fetching modmail settings for ${guild.name}:`, settingsResult.error);
          continue;
        }

        if (settingsResult.data) {
          targetGuild = { discord: guild, db: dbGuild };
          settings = settingsResult.data;
          console.log(`[Modmail] Found enabled modmail for guild ${guild.name} (${guild.id})`);
          break;
        } else {
          console.log(`[Modmail] No enabled modmail settings found for ${guild.name}`);
        }
      }

      if (!targetGuild || !settings) {
        await message.reply('Der er ingen servere med modmail aktiveret, som du er medlem af.');
        this.markDMFailed(message);
        return;
      }

      // Check for existing open thread
      const threadResult = await this.callEdgeFunction('getOpenThread', {
        guildDbId: targetGuild.db.id,
        userId: message.author.id
      });

      let thread = threadResult.data;

      if (!thread) {
        // Create new thread
        thread = await this.createThread(message.author, targetGuild, settings);
        
        if (!thread) {
          await message.reply('Kunne ikke oprette modmail-tråd. Prøv igen senere.');
          this.markDMFailed(message);
          return;
        }

        // Send welcome message
        if (settings.welcome_message) {
          await message.reply(settings.welcome_message);
        }
      }

      // Forward message to staff channel
      console.log(`[Modmail] Forwarding message to staff channel. Thread ID: ${thread.id}, Channel ID: ${thread.channel_id}`);
      await this.forwardToStaff(message, thread, targetGuild.discord);

      // Save message to database
      console.log(`[Modmail] Saving message to database for thread ${thread.id}`);
      await this.saveMessage(thread.id, 'user', message.author.id, message.author.username, message.content, message.attachments);

      // React to confirm receipt
      await message.react('✅');
      console.log(`[Modmail] Successfully processed DM from ${message.author.username}`);
      
      // Mark as successfully processed
      this.markDMProcessed(message);

    } catch (error) {
      console.error('[Modmail] Error handling DM:', error);
      console.error('[Modmail] Error stack:', error.stack);
      this.markDMFailed(message);
      await message.reply('Der opstod en fejl. Prøv igen senere.').catch(() => {});
    }
  }

  async handleStaffReply(message) {
    try {
      // Check if this channel is a modmail thread
      const threadResult = await this.callEdgeFunction('getThreadByChannelId', {
        channelId: message.channel.id
      });

      if (threadResult.error || !threadResult.data) {
        this.markStaffReplyFailed(message.id);
        return;
      }

      const thread = threadResult.data;

      // Get settings
      const settingsResult = await this.callEdgeFunction('getSettingsByGuildId', {
        guildDbId: thread.guild_id
      });

      if (settingsResult.error || !settingsResult.data) {
        this.markStaffReplyFailed(message.id);
        return;
      }

      // Forward to user via DM
      const success = await this.forwardToUser(message, thread);

      if (success) {
        // Save message to database
        await this.saveMessage(thread.id, 'staff', message.author.id, message.author.username, message.content, message.attachments);
        
        // React to confirm
        await message.react('📨');
        
        // Mark as successfully processed
        this.markStaffReplyProcessed(message.id);
      } else {
        this.markStaffReplyFailed(message.id);
        await message.reply('❌ Kunne ikke sende besked til brugeren. De har muligvis lukket deres DMs.');
      }

    } catch (error) {
      console.error('[Modmail] Error handling staff reply:', error);
      this.markStaffReplyFailed(message.id);
    }
  }

  async createThread(user, targetGuild, settings) {
    try {
      const guild = targetGuild.discord;

      // Get or create category
      let category = null;
      if (settings.category_id) {
        category = await guild.channels.fetch(settings.category_id).catch(() => null);
      }

      // Create channel for this thread
      const channelName = `modmail-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 100);
      
      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Modmail fra ${user.username} (${user.id})`,
        reason: 'Modmail thread'
      };

      if (category) {
        channelOptions.parent = category.id;
      }

      // Set permissions
      const permissionOverwrites = [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        }
      ];

      if (settings.staff_role_id) {
        permissionOverwrites.push({
          id: settings.staff_role_id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        });
      }

      channelOptions.permissionOverwrites = permissionOverwrites;

      const channel = await guild.channels.create(channelOptions);

      // Create initial embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📬 Ny Modmail')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Bruger', value: `${user.username} (${user.id})`, inline: true },
          { name: 'Oprettet', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'Skriv i denne kanal for at svare brugeren' });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('modmail_close')
            .setLabel('Luk Modmail')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId('modmail_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✋')
        );

      await channel.send({ embeds: [embed], components: [row] });

      // Save thread to database via edge function
      const createResult = await this.callEdgeFunction('createThread', {
        guildDbId: targetGuild.db.id,
        userId: user.id,
        userName: user.username,
        userAvatar: user.displayAvatarURL({ dynamic: true }),
        channelId: channel.id
      });

      if (createResult.error) {
        console.error('[Modmail] Error creating thread in DB:', createResult.error);
        await channel.delete();
        return null;
      }

      return createResult.data;

    } catch (error) {
      console.error('[Modmail] Error creating thread:', error);
      return null;
    }
  }

  async forwardToStaff(message, thread, discordGuild) {
    try {
      const channel = await discordGuild.channels.fetch(thread.channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(message.content || '*Ingen tekst*')
        .setTimestamp()
        .setFooter({ text: 'Fra bruger' });

      // Handle attachments
      const files = message.attachments.map(a => a.url);

      await channel.send({ embeds: [embed], files });

    } catch (error) {
      console.error('[Modmail] Error forwarding to staff:', error);
    }
  }

  async forwardToUser(message, thread) {
    try {
      const user = await this.client.users.fetch(thread.user_id);
      if (!user) return false;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: `${message.author.username} (Staff)`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(message.content || '*Ingen tekst*')
        .setTimestamp()
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

      // Handle attachments
      const files = message.attachments.map(a => a.url);

      await user.send({ embeds: [embed], files });
      return true;

    } catch (error) {
      console.error('[Modmail] Error forwarding to user:', error);
      return false;
    }
  }

  async saveMessage(threadId, authorType, authorId, authorName, content, attachments) {
    const attachmentData = attachments 
      ? Array.from(attachments.values()).map(a => ({
          url: a.url,
          name: a.name,
          contentType: a.contentType
        }))
      : [];

    await this.callEdgeFunction('saveMessage', {
      threadId,
      authorType,
      authorId,
      authorName,
      content: content || '',
      attachments: attachmentData
    });
  }

  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    // Only handle modmail buttons
    if (!['modmail_close', 'modmail_claim'].includes(interaction.customId)) return;
    
    console.log(`[Modmail] Button interaction received: ${interaction.customId} from ${interaction.user.username} in channel ${interaction.channel?.id}`);

    // Dedup check for button interactions
    const interactionHash = `btn:${interaction.id}`;
    if (processingDMs.has(interactionHash)) {
      console.log(`[Modmail] Skipping duplicate button interaction: ${interactionHash}`);
      return;
    }
    processingDMs.add(interactionHash);
    
    // Clean up after 10 seconds
    setTimeout(() => processingDMs.delete(interactionHash), 10000);

    if (interaction.customId === 'modmail_close') {
      await this.closeThread(interaction);
    } else if (interaction.customId === 'modmail_claim') {
      await this.claimThread(interaction);
    }
  }

  async closeThread(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      console.log(`[Modmail] Closing thread for channel ${interaction.channel.id}`);
      
      const result = await this.callEdgeFunction('closeThread', {
        channelId: interaction.channel.id
      });

      console.log(`[Modmail] closeThread result:`, JSON.stringify(result));

      if (result.error || !result.thread) {
        console.log(`[Modmail] Close failed: ${result.error || 'no thread'}`);
        await interaction.editReply({ content: 'Denne modmail er allerede lukket eller kunne ikke findes.' });
        return;
      }

      // Send close message to user
      if (result.closeMessage) {
        try {
          const user = await this.client.users.fetch(result.thread.user_id);
          if (user) {
            await user.send(result.closeMessage);
          }
        } catch (e) {
          console.log(`[Modmail] Could not send close message to user: ${e.message}`);
        }
      }

      // Delete channel after a short delay
      await interaction.editReply({ content: '✅ Modmail lukket. Kanalen slettes om 5 sekunder...' });
      
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Modmail lukket');
        } catch (e) {
          console.error('[Modmail] Error deleting channel:', e);
        }
      }, 5000);

    } catch (error) {
      console.error('[Modmail] Error closing thread:', error);
      await interaction.editReply({ content: '❌ Kunne ikke lukke modmail.' }).catch(() => {});
    }
  }

  async claimThread(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      console.log(`[Modmail] Claiming thread for channel ${interaction.channel.id} by ${interaction.user.username}`);

      const result = await this.callEdgeFunction('claimThread', {
        channelId: interaction.channel.id,
        claimedById: interaction.user.id,
        claimedByName: interaction.user.username
      });

      console.log(`[Modmail] claimThread result:`, JSON.stringify(result));

      if (result.error === 'already_claimed') {
        await interaction.editReply({ content: `Denne modmail er allerede claimed af ${result.claimedByName}.` });
        return;
      }

      if (result.error) {
        console.log(`[Modmail] Claim failed: ${result.error}`);
        await interaction.editReply({ content: `Kunne ikke finde modmail-tråden: ${result.error}` });
        return;
      }

      await interaction.editReply({ content: `✅ Du har claimed denne modmail.` });
      await interaction.channel.send(`📌 **${interaction.user.username}** har claimed denne modmail.`);

    } catch (error) {
      console.error('[Modmail] Error claiming thread:', error);
      await interaction.editReply({ content: '❌ Kunne ikke claime modmail.' }).catch(() => {});
    }
  }
}

// Wrapper function for consistent API
function setupModmailHandler(client, supabaseUrl, botSecretKey, config = {}) {
  const handler = new ModmailHandler(client, supabaseUrl, botSecretKey, config);
  handler.init();
  return handler;
}

module.exports = { ModmailHandler, setupModmailHandler };
