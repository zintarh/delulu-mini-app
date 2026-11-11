"use client";

import type { RewardCategory } from "@/lib/rewards/rules";

export const REWARD_CATEGORY_LABEL: Record<RewardCategory, string> = {
  daily_proof: "Daily proof",
  weekly_consistency: "Weekly consistency",
  campaign_completion: "Campaign completion",
  goal_completion: "Goal completion",
};

export const REWARD_CATEGORIES = Object.keys(REWARD_CATEGORY_LABEL) as RewardCategory[];

export function formatG(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} G$`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** fetch + JSON with the dashboard's error convention ({ error }). */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error(json.error ?? `Request failed: ${res.status}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/** Readable label for a config path in diffs and the audit log. */
export function configPathLabel(path: string): string {
  const map: Record<string, string> = {
    enabled: "Rewards engine",
    timezone: "Reward calendar timezone",
    "dailyProof.enabled": "Daily proof · on",
    "dailyProof.amount": "Daily proof · amount",
    "dailyProof.maxEligibleGoals": "Daily proof · goals per user per day",
    "dailyProof.abandonCooldownDays": "Daily proof · abandoned-goal cooldown (days)",
    "dailyProof.idleReleaseDays": "Daily proof · idle goal release (days)",
    "weeklyConsistency.enabled": "Weekly consistency · on",
    "weeklyConsistency.amount": "Weekly consistency · amount",
    "weeklyConsistency.minProofs": "Weekly consistency · proofs needed",
    "campaignCompletion.enabled": "Campaign completion · on",
    "campaignCompletion.tiers": "Campaign completion · tiers",
    "campaignCompletion.lateJoinExponent": "Campaign completion · late-join curve",
    "goalCompletion.enabled": "Goal completion · on",
    "goalCompletion.tiers": "Goal completion · tiers",
    "goalCompletion.shareExponent": "Goal completion · slot-share curve",
    "limits.dailyBudget": "Platform daily budget (G$)",
  };
  return map[path] ?? path;
}

export function formatConfigValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (Array.isArray(v)) {
    if (v.length === 0) return "None";
    return [...v]
      .sort((a, b) => a.minDays - b.minDays)
      .map((t: { minDays: number; amount: number }) => `${t.minDays}d → ${t.amount.toLocaleString("en-US")}`)
      .join(", ");
  }
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (v == null) return "—";
  return String(v);
}
