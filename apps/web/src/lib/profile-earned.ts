import { getSupabaseAdmin } from "@/lib/push/supabase";
import { tokenAmountToUsdt } from "@/lib/earned-usdt";

/**
 * Add `amount` (human units of `tokenAddress`) to profiles.total_earned_usdt.
 * Returns the USDT delta credited, or 0 if nothing was written.
 */
export async function creditProfileEarnedFromToken(input: {
  address: string;
  amount: number;
  tokenAddress: string;
}): Promise<{ creditedUsdt: number; nextTotal: number | null }> {
  const address = input.address.toLowerCase();
  if (!address.startsWith("0x") || address.length !== 42) {
    return { creditedUsdt: 0, nextTotal: null };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { creditedUsdt: 0, nextTotal: null };
  }

  const creditedUsdt = await tokenAmountToUsdt(input.amount, input.tokenAddress);
  if (creditedUsdt <= 0) {
    return { creditedUsdt: 0, nextTotal: null };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { creditedUsdt: 0, nextTotal: null };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("address, total_earned_usdt")
    .ilike("address", address)
    .maybeSingle();

  const prev = Number(existing?.total_earned_usdt);
  const nextTotal = (Number.isFinite(prev) ? prev : 0) + creditedUsdt;
  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("profiles")
      .update({ total_earned_usdt: nextTotal, updated_at: now })
      .eq("address", address);
    if (error) {
      console.error("[creditProfileEarned] update failed:", error.message);
      return { creditedUsdt: 0, nextTotal: null };
    }
  } else {
    const { error } = await supabase.from("profiles").insert({
      address,
      email: `${address}@wallet.local`,
      total_earned_usdt: nextTotal,
      claim_count: 0,
      updated_at: now,
    });
    if (error) {
      console.error("[creditProfileEarned] insert failed:", error.message);
      return { creditedUsdt: 0, nextTotal: null };
    }
  }

  return { creditedUsdt, nextTotal };
}
