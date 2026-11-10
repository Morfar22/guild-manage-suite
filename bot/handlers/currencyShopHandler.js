/**
 * Currency Shop Handler
 *
 * Manages a shop where users can buy items (roles, etc.) with economy currency.
 */

const {
  inspectRoleDelivery,
  reserveOrder,
  processShopOrder,
  processPendingShopOrders,
} = require("../utils/shopOrders");
const { EmbedBuilder } = require("discord.js");

const shopCache = new Map();
const CACHE_TTL = 300_000;

function setupCurrencyShopHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getShopItems(guildUuid) {
    const cached = shopCache.get(guildUuid);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data, error } = await supabase
      .from("economy_shop_items")
      .select("*")
      .eq("guild_id", guildUuid)
      .eq("enabled", true)
      .order("price", { ascending: true });

    if (error) throw error;
    shopCache.set(guildUuid, { data: data || [], _ts: Date.now() });
    return data || [];
  }

  async function handleShopCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

    const { data: guild } = await supabase
      .from("guilds")
      .select("id")
      .eq("guild_id", interaction.guild.id)
      .single();
    if (!guild) return;

    const items = await getShopItems(guild.id);
    if (items.length === 0) {
      await interaction.reply({
        content: "🛒 Butikken er tom!",
        ephemeral: true,
      });
      return;
    }

    const { data: ecoSettings } = await supabase
      .from("economy_settings")
      .select("currency_symbol")
      .eq("guild_id", guild.id)
      .maybeSingle();
    const symbol = ecoSettings?.currency_symbol || "💰";

    const embed = new EmbedBuilder()
      .setTitle("🛒 Butik")
      .setColor(0x57f287)
      .setDescription(
        items
          .map(
            (item, i) =>
              `**${i + 1}.** ${item.name} — ${symbol} ${item.price}${item.stock !== null ? ` (${item.stock} på lager)` : ""}\n${item.description || ""}`,
          )
          .join("\n\n"),
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  const errorMessages = {
    insufficient: "Du har ikke nok coins til denne vare.",
    out_of_stock: "Varen er udsolgt.",
    item_unavailable: "Varen er ikke tilgængelig.",
    item_changed:
      "Varen blev ændret under købet. Prøv igen med de nye oplysninger.",
    purchase_pending:
      "Du har allerede en ordre på denne rolle, som afventer levering eller kontrol.",
    invalid_input: "Købet har ugyldige oplysninger.",
  };
  const describeOrder = (order) => {
    const ref = `Ordre ${order.id}`;
    if (order.status === "delivered")
      return `✅ Du har købt **${order.item_name}** for **${order.price}**! 🛍️\n${ref}`;
    if (order.status === "refunded")
      return `❌ Rollen kunne ikke leveres. Dine **${order.price}** coins er tilbagebetalt.\n${ref}`;
    if (order.status === "manual_review")
      return `⚠️ Leveringen kan ikke bekræftes. Kontakt staff med **${ref}**. Købet gentages eller tilbagebetales ikke automatisk, før resultatet er kontrolleret.`;
    if (order.status === "rejected")
      return `❌ ${errorMessages[order.last_error] || "Købet kunne ikke gennemføres."} Der er ikke trukket coins for denne ordre.`;
    return `⏳ Dit køb af **${order.item_name}** afventer levering. Botten genoptager ordren automatisk, også efter en genstart.\n${ref}`;
  };

  async function handleBuyCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferReply({ flags: 64 });
    let reservationStarted = false;
    try {
      const { data: guild, error: guildError } = await supabase
        .from("guilds")
        .select("id")
        .eq("guild_id", interaction.guild.id)
        .single();
      if (guildError) throw guildError;
      if (!guild) throw new Error("Serveren findes ikke i databasen.");
      // A duplicate Discord interaction must replay its receipt, even if the
      // item has since changed, been disabled or removed from the shop.
      const { data: existing, error: receiptError } = await supabase
        .from("bot_shop_orders")
        .select("*")
        .eq("interaction_id", interaction.id)
        .maybeSingle();
      if (receiptError) throw receiptError;
      if (existing) {
        if (
          existing.guild_id !== guild.id ||
          existing.user_id !== interaction.user.id
        )
          throw new Error("Ordren tilhører en anden bruger.");
        reservationStarted = true;
        const resolved = ["pending", "processing"].includes(existing.status)
          ? await processShopOrder(client, supabase, existing, {
              guild: interaction.guild,
              shouldHandleGuild,
              isStopped: () => stopped,
            })
          : existing;
        await interaction.editReply({
          content: describeOrder(resolved || existing),
        });
        return;
      }
      const itemName = interaction.options.getString("item")?.trim();
      if (!itemName || itemName.length > 100) {
        await interaction.editReply({
          content: "❌ Angiv et gyldigt varenavn.",
        });
        return;
      }
      const escaped = itemName.replace(/[\\%_]/g, "\\$&");
      const { data: items, error: itemError } = await supabase
        .from("economy_shop_items")
        .select("*")
        .eq("guild_id", guild.id)
        .eq("enabled", true)
        .ilike("name", `%${escaped}%`)
        .limit(2);
      if (itemError) throw itemError;
      if (items?.length !== 1) {
        await interaction.editReply({
          content: items?.length
            ? "❌ Flere varer matcher navnet. Angiv et mere præcist navn."
            : "❌ Vare ikke fundet.",
        });
        return;
      }
      const item = items[0];
      if (!Number.isSafeInteger(item.price) || item.price < 0)
        throw new Error("Varen har en ugyldig pris.");
      if (item.role_id) {
        const delivery = await inspectRoleDelivery(
          interaction.guild,
          interaction.user.id,
          item.role_id,
        );
        if (delivery.alreadyOwned) {
          await interaction.editReply({
            content:
              "❌ Du har allerede denne rolle. Der er ikke trukket coins.",
          });
          return;
        }
      }
      reservationStarted = true;
      const result = await reserveOrder(supabase, interaction, guild.id, item);
      if (!result.ok) {
        await interaction.editReply({
          content: result.order
            ? describeOrder(result.order)
            : `❌ ${errorMessages[result.reason] || "Købet kunne ikke gennemføres."}`,
        });
        return;
      }
      shopCache.delete(guild.id);
      const resolved =
        result.order.status === "pending"
          ? await processShopOrder(client, supabase, result.order, {
              guild: interaction.guild,
              shouldHandleGuild,
              isStopped: () => stopped,
            })
          : result.order;
      await interaction.editReply({
        content: describeOrder(resolved || result.order),
      });
    } catch (error) {
      console.error("[CurrencyShop] Purchase failed:", error.message);
      await interaction.editReply({
        content: reservationStarted
          ? "⚠️ Købets status kunne ikke bekræftes. En registreret ordre gemmes og genoptages automatisk. Kontakt staff, hvis den fortsat afventer."
          : `❌ ${error.permanent ? error.message : "Butikken kunne ikke kontaktes."} Der er ikke trukket coins.`,
      });
    }
  }

  let polling = false;
  let stopped = false;
  const recover = async () => {
    if (polling || stopped) return;
    polling = true;
    try {
      await processPendingShopOrders(client, supabase, {
        shouldHandleGuild,
        isStopped: () => stopped,
      });
    } catch (error) {
      console.error("[CurrencyShop] Recovery failed:", error.message);
    } finally {
      polling = false;
    }
  };
  const recoveryTimer = setInterval(() => void recover(), 15_000);
  recoveryTimer.unref?.();
  void recover();
  const cleanup = () => {
    stopped = true;
    clearInterval(recoveryTimer);
  };

  console.log("[CurrencyShop] Handler initialized");
  return { handleShopCommand, handleBuyCommand, cleanup };
}

module.exports = { setupCurrencyShopHandler };
