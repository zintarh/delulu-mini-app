import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadStakeActivity } from "@/lib/season/activity";
import { stakeTierFor } from "@/lib/season/rules";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * "Your First Week": a one-time 7-day Bingo with a welcome bonus (4,400 G$ = 7 × 300 + 2,300 for finishing, plus the 1k stake back; lowered 25 Nov 2026 from 500 + 5,750 for sustainability — scripts/first-week-reduce.ts) to
 * get new players into a 7-day habit. Only for new players (first 2 weeks) and
 * anyone who joined through a friend's invite — and once each (one_time).
 * Everyone else stakes more to earn more on the regular Bingos.
 */
export const FIRST_WEEK_SLUG = "first-week";

export const isFirstWeekSlug = (slug: string | null | undefined) => slug === FIRST_WEEK_SLUG;

/** Pure rule: a newcomer, or invited by a friend. (Played-before is enforced by one_time.) */
export function firstWeekEligibleFrom(a: { newcomer: boolean; referred: boolean }): boolean {
  return a.newcomer || a.referred;
}

export async function isFirstWeekEligible(admin: Admin, wallet: string | null | undefined): Promise<boolean> {
  if (!wallet) return false;
  const w = wallet.toLowerCase();
  const [activity, { data: profile }] = await Promise.all([
    loadStakeActivity(admin, w),
    admin.from("profiles").select("referred_by").eq("address", w).maybeSingle(),
  ]);
  return firstWeekEligibleFrom({ newcomer: stakeTierFor(activity) === "newcomer", referred: !!profile?.referred_by });
}
