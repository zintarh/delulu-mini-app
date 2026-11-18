import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchKeptDayEventsSince } from "@/lib/community/campaign-subgraph";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const DAY = 86_400_000;
/** The goal: 1 in 10 new people still keeping days in their second week. */
export const WEEK1_RETENTION_TARGET = 0.1;

export type RetentionCohort = {
  /** Monday the cohort's week starts (Lagos), YYYY-MM-DD. */
  week: string;
  signups: number;
  /** Kept at least one day, ever. */
  started: number;
  /** Kept a day on days 7–13 after signing up — "still here after week 1". Null until that window has passed. */
  week1: number | null;
};

/** Pure: weekly signup cohorts and how many were still keeping days in their second week. */
export function cohortRetention(
  signups: { wallet: string; createdMs: number }[],
  activity: Map<string, number[]>,
  nowMs: number,
): RetentionCohort[] {
  const weekStart = (ms: number) => {
    const lagos = new Date(ms + 3_600_000);
    const dow = (lagos.getUTCDay() + 6) % 7; // Monday = 0
    return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - dow)).toISOString().slice(0, 10);
  };
  const groups = new Map<string, { wallet: string; createdMs: number }[]>();
  for (const s of signups) {
    const k = weekStart(s.createdMs);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, people]) => {
      const lastSignup = Math.max(...people.map((p) => p.createdMs));
      const measurable = nowMs >= lastSignup + 14 * DAY;
      let started = 0;
      let week1 = 0;
      for (const p of people) {
        const ts = activity.get(p.wallet) ?? [];
        if (ts.some((t) => t >= p.createdMs)) started++;
        if (ts.some((t) => t >= p.createdMs + 7 * DAY && t < p.createdMs + 14 * DAY)) week1++;
      }
      return { week, signups: people.length, started, week1: measurable ? week1 : null };
    });
}

/** wallet → times of every kept day since `sinceMs` (on-chain proofs + AI-approved photos). */
export async function loadActivity(admin: Admin, sinceMs: number): Promise<Map<string, number[]>> {
  const [events, { data: photos }] = await Promise.all([
    fetchKeptDayEventsSince(Math.floor(sinceMs / 1000)).catch(() => [] as [string, number][]),
    admin.from("proof_image_fingerprints").select("wallet, created_at").eq("status", "accepted").gte("created_at", new Date(sinceMs).toISOString()).limit(50_000),
  ]);
  const activity = new Map<string, number[]>();
  const add = (w: string, t: number) => activity.set(w, [...(activity.get(w) ?? []), t]);
  for (const [w, t] of events) add(w, t);
  for (const p of photos ?? []) add(String(p.wallet).toLowerCase(), Date.parse(String(p.created_at)));
  return activity;
}

/** Loads signups + every kept day (on-chain and AI-approved photos) and builds the cohorts. */
export async function loadRetention(admin: Admin, weeks = 10, nowMs = Date.now()): Promise<{ cohorts: RetentionCohort[]; activeLast7d: number }> {
  const sinceMs = nowMs - weeks * 7 * DAY;
  const [events, { data: photos }, { data: profiles }] = await Promise.all([
    fetchKeptDayEventsSince(Math.floor(sinceMs / 1000)).catch(() => [] as [string, number][]),
    admin.from("proof_image_fingerprints").select("wallet, created_at").eq("status", "accepted").gte("created_at", new Date(sinceMs).toISOString()).limit(50_000),
    admin.from("profiles").select("address, created_at").gte("created_at", new Date(sinceMs).toISOString()).limit(20_000),
  ]);
  const activity = new Map<string, number[]>();
  const add = (w: string, t: number) => activity.set(w, [...(activity.get(w) ?? []), t]);
  for (const [w, t] of events) add(w, t);
  for (const p of photos ?? []) add(String(p.wallet).toLowerCase(), Date.parse(String(p.created_at)));
  const signups = (profiles ?? []).map((p) => ({ wallet: String(p.address).toLowerCase(), createdMs: Date.parse(String(p.created_at)) }));
  const activeLast7d = [...activity.values()].filter((ts) => ts.some((t) => nowMs - t < 7 * DAY)).length;
  return { cohorts: cohortRetention(signups, activity, nowMs), activeLast7d };
}
