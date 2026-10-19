"use strict";

/**
 * Race-safe wallet/bank updates for economy_accounts.
 *
 * Supabase JS has no transactions, and the previous read-modify-write code let
 * concurrent /pay, /rob, /deposit or /withdraw calls double-spend. Every update
 * here is a compare-and-swap: it only applies when wallet and bank still hold
 * the values we read, and retries with fresh values otherwise. Balances never
 * go below zero.
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

/**
 * Move `amount` from one account's wallet to another's. The debit happens
 * first; if the credit fails the debit is refunded.
 */
async function transferWallet(supabase, fromAccountId, toAccountId, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (fromAccountId === toAccountId)
    return { ok: false, reason: "same_account" };

  const debit = await adjustBalance(supabase, fromAccountId, {
    wallet: -amount,
  });
  if (!debit.ok) return debit;

  let credit;
  try {
    credit = await adjustBalance(supabase, toAccountId, { wallet: amount });
  } catch (error) {
    credit = { ok: false, reason: "error", error };
  }
  if (!credit.ok) {
    await adjustBalance(supabase, fromAccountId, { wallet: amount });
    return { ok: false, reason: credit.reason || "credit_failed" };
  }
  return { ok: true, from: debit.account, to: credit.account };
}

module.exports = { adjustBalance, transferWallet };
