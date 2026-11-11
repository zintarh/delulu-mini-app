/**
 * Strict validation for admin edits to the Rewards Engine config. The
 * engine's own loader (resolveRewardsConfig) is lenient so a bad row can
 * never take rewards down; this is the gate that keeps bad values out of
 * the row in the first place. No "@/" imports — unit-tested directly.
 */
import { z } from "zod";
import type { CompletionTier, RewardsConfig } from "./rules";

const int = (min: number, max: number) => z.number().int().min(min).max(max);

const tiersSchema = z
  .array(z.object({ minDays: int(1, 365), amount: int(0, 1_000_000) }).strict())
  .max(6)
  .superRefine((tiers, ctx) => {
    const days = tiers.map((t) => t.minDays);
    if (new Set(days).size !== days.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each tier needs a different length" });
    }
    const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].amount < sorted[i - 1].amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `A ${sorted[i].minDays}-day tier can't pay less than the ${sorted[i - 1].minDays}-day tier`,
        });
      }
    }
  });

const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown timezone");

export const rewardsConfigSchema = z
  .object({
    enabled: z.boolean(),
    timezone: timezoneSchema,
    dailyProof: z
      .object({
        enabled: z.boolean(),
        amount: int(0, 100_000),
        maxEligibleGoals: int(1, 10),
        abandonCooldownDays: int(0, 60),
        idleReleaseDays: int(1, 90),
      })
      .strict(),
    weeklyConsistency: z
      .object({ enabled: z.boolean(), amount: int(0, 100_000), minProofs: int(1, 70) })
      .strict(),
    campaignCompletion: z
      .object({ enabled: z.boolean(), tiers: tiersSchema, lateJoinExponent: z.number().min(1).max(4) })
      .strict(),
    goalCompletion: z
      .object({ enabled: z.boolean(), tiers: tiersSchema, shareExponent: z.number().min(1).max(4) })
      .strict(),
    limits: z.object({ dailyBudget: int(0, 100_000_000) }).strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    // At most maxEligibleGoals daily rewards a day → at most 7× that a week.
    const reachable = c.dailyProof.maxEligibleGoals * 7;
    if (c.weeklyConsistency.minProofs > reachable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weeklyConsistency", "minProofs"],
        message: `Unreachable: at most ${reachable} proofs can earn in a week with ${c.dailyProof.maxEligibleGoals} goals/day`,
      });
    }
    if (c.limits.dailyBudget > 0) {
      const largest = Math.max(
        c.dailyProof.amount,
        c.weeklyConsistency.amount,
        ...c.campaignCompletion.tiers.map((t) => t.amount),
        ...c.goalCompletion.tiers.map((t) => t.amount),
      );
      if (c.limits.dailyBudget < largest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["limits", "dailyBudget"],
          message: `Must be at least the largest single reward (${largest} G$), or that reward could never be sent`,
        });
      }
    }
  });

export type ConfigIssue = { path: string; message: string };

export function validateRewardsConfig(
  input: unknown,
): { ok: true; config: RewardsConfig } | { ok: false; issues: ConfigIssue[] } {
  const parsed = rewardsConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const c = parsed.data;
  const sortTiers = (t: CompletionTier[]) => [...t].sort((a, b) => b.minDays - a.minDays);
  return {
    ok: true,
    config: {
      ...c,
      campaignCompletion: { ...c.campaignCompletion, tiers: sortTiers(c.campaignCompletion.tiers) },
      goalCompletion: { ...c.goalCompletion, tiers: sortTiers(c.goalCompletion.tiers) },
    },
  };
}

export type ConfigChange = { path: string; before: unknown; after: unknown };

function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

const tierKey = (v: unknown) =>
  Array.isArray(v) ? JSON.stringify([...v].sort((a, b) => a.minDays - b.minDays)) : JSON.stringify(v);

/** Field-by-field differences (tier lists compared as a whole), for the confirm step and the audit log. */
export function diffRewardsConfig(before: RewardsConfig, after: RewardsConfig): ConfigChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const changes: ConfigChange[] = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (tierKey(a[path]) !== tierKey(b[path])) changes.push({ path, before: a[path], after: b[path] });
  }
  return changes;
}
