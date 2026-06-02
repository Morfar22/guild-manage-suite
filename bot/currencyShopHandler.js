/**
 * Currency Shop Handler
 * 
 * Manages a shop where users can buy items (roles, etc.) with economy currency.
 */

const { EmbedBuilder } = require('discord.js');

const shopCache = new Map();
const CACHE_TTL = 300_000;

function setupCurrencyShopHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getShopItems(guildUuid) {
    const cached = shopCache.get(guildUuid);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data } = await supabase
      .from('economy_shop_items')
      .select('*')
      .eq('guild_id', guildUuid)
      .eq('enabled', true)
      .order('price', { ascending: true });

    shopCache.set(guildUuid, { data: data || [], _ts: Date.now() });
    return data || [];
  }

  async function handleShopCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
    if (!guild) return;

    const items = await getShopItems(guild.id);
    if (items.length === 0) {
      await interaction.reply({ content: '🛒 Butikken er tom!', ephemeral: true });
      return;
    }

    const { data: ecoSettings } = await supabase
      .from('economy_settings').select('currency_symbol').eq('guild_id', guild.id).maybeSingle();
    const symbol = ecoSettings?.currency_symbol || '💰';

    const embed = new EmbedBuilder()
      .setTitle('🛒 Butik')
      .setColor(0x57F287)
      .setDescription(items.map((item, i) =>
        `**${i + 1}.** ${item.name} — ${symbol} ${item.price}${item.stock !== null ? ` (${item.stock} på lager)` : ''}\n${item.description || ''}`
      ).join('\n\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async function handleBuyCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

    const itemName = interaction.options.getString('item');

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
    if (!guild) return;

    // Find item
    const { data: items } = await supabase
      .from('economy_shop_items')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('enabled', true)
      .ilike('name', `%${itemName}%`)
      .limit(1);

    const item = items?.[0];
    if (!item) {
      await interaction.reply({ content: '❌ Vare ikke fundet.', ephemeral: true });
      return;
    }

    // Check stock
    if (item.stock !== null && item.stock <= 0) {
      await interaction.reply({ content: '❌ Varen er udsolgt.', ephemeral: true });
      return;
    }

    // Check balance
    const { data: account } = await supabase
      .from('economy_accounts')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('user_id', interaction.user.id)
      .maybeSingle();

    const balance = (account?.wallet || 0);
    if (balance < item.price) {
      await interaction.reply({ content: `❌ Du har ikke nok penge. Du har **${balance}**, men varen koster **${item.price}**.`, ephemeral: true });
      return;
    }

    // Deduct
    await supabase.from('economy_accounts')
      .update({ wallet: balance - item.price })
      .eq('guild_id', guild.id)
      .eq('user_id', interaction.user.id);

    // Update stock
    if (item.stock !== null) {
      await supabase.from('economy_shop_items')
        .update({ stock: item.stock - 1 })
        .eq('id', item.id);
    }

    // Grant role if applicable
    if (item.role_id) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (member) {
        await member.roles.add(item.role_id, `Købt fra butik: ${item.name}`).catch(() => {});
      }
    }

    // Record purchase
    await supabase.from('economy_purchases').insert({
      guild_id: guild.id,
      user_id: interaction.user.id,
      user_name: interaction.user.username,
      item_id: item.id,
    });

    await interaction.reply({ content: `✅ Du har købt **${item.name}** for **${item.price}**! 🛍️`, ephemeral: true });
    shopCache.delete(guild.id);
  }

  console.log('[CurrencyShop] Handler initialized');
  return { handleShopCommand, handleBuyCommand };
}

module.exports = { setupCurrencyShopHandler };
