import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { stakeRulesView, type StakeActivity, type StakeRulesView } from "@/lib/season/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Profile age + accepted proofs / active days — what decides newcomer vs regular. */
export async function loadStakeActivity(admin: SupabaseAdmin, wallet: string): Promise<StakeActivity> {
  const w = wallet.trim().toLowerCase();
  const [{ data: profile }, { data: proofs }] = await Promise.all([
    admin.from("profiles").select("created_at").ilike("address", w).maybeSingle(),
    admin.from("proof_image_fingerprints").select("created_at").eq("status", "accepted").ilike("wallet", w).limit(5000),
  ]);
  const days = new Set((proofs ?? []).map((p) => String(p.created_at).slice(0, 10)));
  const created = profile?.created_at ? Date.parse(String(profile.created_at)) : NaN;
  return {
    firstSeenMs: Number.isFinite(created) ? created : null,
    acceptedProofs: proofs?.length ?? 0,
    activeDays: days.size,
  };
}

export async function loadStakeRules(admin: SupabaseAdmin, wallet: string): Promise<StakeRulesView> {
  return stakeRulesView(await loadStakeActivity(admin, wallet));
}

/** Server-side gate message, or null when the stake is allowed. */
export function stakeGateError(rules: StakeRulesView, stakeWhole: number): string | null {
  if (!rules.live) return null;
  if (stakeWhole <= 0 && rules.canPledgeWord) return null;
  if (stakeWhole < rules.minStake) {
    return `Stake at least ${rules.minStake.toLocaleString("en-US")} G$ to join.`;
  }
  return null;
}
