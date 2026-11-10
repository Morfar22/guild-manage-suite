"use strict";

/**
 * Wallet/bank operations for economy_accounts.
 *
 * Single-account adjustments used by games/shop remain compare-and-swap.
 * Commands that move money or issue rewards use a PostgreSQL transaction so
 * balances, cooldowns, the ledger and the Discord interaction receipt commit
 * together. Never emulate a transfer with a debit followed by a refund.
 */

const DEFAULT_RETRIES = 5;

function matchCurrent(query, column, value) {
  return value === null || value === undefined
    ? query.is(column, null)
    : query.eq(column, value);
}

async function adjustBalance(
  supabase,
  accountId,
  { wallet = 0, bank = 0 },
  { retries = DEFAULT_RETRIES } = {},
) {
  if (!Number.isSafeInteger(wallet) || !Number.isSafeInteger(bank)) {
    return { ok: false, reason: "invalid_amount" };
  }
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data: current, error: readError } = await supabase
      .from("economy_accounts")
      .select("id, wallet, bank")
      .eq("id", accountId)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return { ok: false, reason: "not_found" };

    const nextWallet = (current.wallet || 0) + wallet;
    const nextBank = (current.bank || 0) + bank;
    if (!Number.isSafeInteger(nextWallet) || !Number.isSafeInteger(nextBank)) {
      return { ok: false, reason: "balance_limit" };
    }
    if (nextWallet < 0 || nextBank < 0) {
      return { ok: false, reason: "insufficient", account: current };
    }

    let query = supabase
      .from("economy_accounts")
      .update({ wallet: nextWallet, bank: nextBank })
      .eq("id", accountId);
    query = matchCurrent(query, "wallet", current.wallet);
    query = matchCurrent(query, "bank", current.bank);
    const { data: updated, error: updateError } =
      await query.select("id, wallet, bank");
    if (updateError) throw updateError;
    if (Array.isArray(updated) && updated.length === 1) {
      return { ok: true, account: updated[0] };
    }
    // Lost the race: another update changed the row; retry with fresh data.
  }
  return { ok: false, reason: "conflict" };
}

async function economyOperation(
  supabase,
  interaction,
  guildId,
  operation,
  options = {},
) {
  const { data, error } = await supabase.rpc("bot_economy_operation", {
    p_operation: operation,
    p_interaction_id: interaction.id,
    p_guild_id: guildId,
    p_user_id: interaction.user.id,
    p_amount: options.amount ?? null,
    p_target_user_id: options.target?.id ?? null,
    p_username: interaction.user.tag,
    p_target_username: options.target?.tag ?? null,
    p_description: options.description ?? null,
  });
  if (error) throw error;
  if (!data || typeof data.ok !== "boolean") {
    throw new Error("Invalid economy operation response");
  }
  return data;
}

module.exports = { adjustBalance, economyOperation };
