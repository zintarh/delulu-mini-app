/**
 * Delulu Support — pure rules shared by API routes and UI. No "@/" imports so
 * it runs under `node --test`.
 */

export const SUPPORT_CATEGORIES = [
  "fitness",
  "learning",
  "productivity",
  "personal_development",
  "finance",
  "lifestyle",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  fitness: "Fitness",
  learning: "Learning",
  productivity: "Productivity",
  personal_development: "Growth",
  finance: "Finance",
  lifestyle: "Lifestyle",
};

export function isSupportCategory(v: unknown): v is SupportCategory {
  return typeof v === "string" && (SUPPORT_CATEGORIES as readonly string[]).includes(v);
}

/** First match wins — specific habits before broad ones. */
const CATEGORY_RULES: Array<[RegExp, SupportCategory]> = [
  [/\b(save|saving|savings|budget|invest|spend|debt|money|income|side hustle)/i, "finance"],
  [/\b(gym|workout|work out|lift|push-?ups?|burpee|squat|exercis|fitness|train|run|jog|walk|steps|marathon|cycl|bike|hike|yoga|swim|cardio|abs)/i, "fitness"],
  [/\b(read|book|page|chapter|learn|study|course|language|spanish|french|duolingo|leetcode|exam|lecture|practice)/i, "learning"],
  [/\b(code|coding|program|ship|build|work|focus|deep work|task|inbox|email|project|wake|early|morning)/i, "productivity"],
  [/\b(meditat|mindful|pray|bible|quran|journal|gratitude|therapy|screen|phone|social media|scroll|tiktok|instagram|porn|smok|alcohol|drink less)/i, "personal_development"],
  [/\b(sleep|bed|water|hydrat|sugar|eat|diet|food|meal|fruit|veg|cook|clean|skin|fast)/i, "lifestyle"],
];

export function suggestCategory(text: string | null | undefined): SupportCategory {
  const t = text ?? "";
  return CATEGORY_RULES.find(([re]) => re.test(t))?.[1] ?? "personal_development";
}

export const PUBLIC_DESCRIPTION_MAX = 280;

/** Trims and bounds the creator-written public blurb; empty → null. */
export function normalizePublicDescription(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, PUBLIC_DESCRIPTION_MAX);
  return t.length > 0 ? t : null;
}

/** Last period's deadline from on-chain schedule state (unix seconds → Date). */
export function computeEndsAt(chain: {
  currentPeriodDeadline: string | number;
  currentPeriodIndex: number;
  totalPeriods: number;
  periodSeconds: string | number;
}): Date | null {
  const deadline = Number(chain.currentPeriodDeadline);
  const period = Number(chain.periodSeconds);
  if (!Number.isFinite(deadline) || deadline <= 0) return null;
  const remaining = Math.max(0, chain.totalPeriods - 1 - chain.currentPeriodIndex);
  const end = deadline + (Number.isFinite(period) && period > 0 ? remaining * period : 0);
  return new Date(end * 1000);
}

export type SupportBlockReason =
  | "not_found"
  | "private"
  | "not_active"
  | "cancelled"
  | "ended"
  | "own";

export type SupportEligibility = { ok: true } | { ok: false; reason: SupportBlockReason };

/**
 * Whether a Delulu accepts support right now. Only public, active goals that
 * are still live on-chain and not past their last deadline qualify.
 */
export function supportEligibility(input: {
  isPrivate: boolean | null | undefined;
  status: string | null | undefined;
  onChain: { active: boolean; cancelled: boolean } | null | undefined;
  endsAt: Date | null | undefined;
  now: Date;
  creatorWallet?: string | null;
  supporterWallet?: string | null;
}): SupportEligibility {
  if (input.isPrivate !== false) return { ok: false, reason: "private" };
  if (input.status !== "active") return { ok: false, reason: "not_active" };
  if (input.onChain?.cancelled) return { ok: false, reason: "cancelled" };
  if (!input.onChain || !input.onChain.active) return { ok: false, reason: "not_active" };
  if (input.endsAt && input.endsAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: "ended" };
  }
  if (
    input.creatorWallet &&
    input.supporterWallet &&
    input.creatorWallet.toLowerCase() === input.supporterWallet.toLowerCase()
  ) {
    return { ok: false, reason: "own" };
  }
  return { ok: true };
}

export const SUPPORT_BLOCK_MESSAGES: Record<SupportBlockReason, string> = {
  not_found: "This Delulu isn't available.",
  private: "This Delulu isn't open for support.",
  not_active: "This Delulu isn't accepting support right now.",
  cancelled: "This Delulu was cancelled.",
  ended: "This Delulu has ended.",
  own: "You can't support your own Delulu.",
};

// ---------------------------------------------------------------------------
// Amounts (G$, 18 decimals)
// ---------------------------------------------------------------------------
export const SUPPORT_PRESET_AMOUNTS = [5_000, 10_000, 25_000, 50_000] as const;
export const SUPPORT_MIN_WHOLE = 1_000;
export const SUPPORT_MAX_WHOLE = 10_000_000;
export const SUPPORT_TOKEN_DECIMALS = 18;

const WEI_PER_WHOLE = 10n ** BigInt(SUPPORT_TOKEN_DECIMALS);

export type ParsedSupportAmount =
  | { ok: true; wei: bigint; whole: number }
  | { ok: false; error: string };

/** Whole-G$ input (up to 2 decimals) → wei, bounded by min/max. */
export function parseSupportAmount(input: string | number): ParsedSupportAmount {
  const raw = String(input).replace(/[,\s_]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, error: "Enter an amount" };
  const [int, frac = ""] = raw.split(".");
  const wei = BigInt(int!) * WEI_PER_WHOLE + BigInt(frac.padEnd(2, "0")) * 10n ** 16n;
  const whole = Number(raw);
  if (whole < SUPPORT_MIN_WHOLE) {
    return { ok: false, error: `Minimum is ${SUPPORT_MIN_WHOLE.toLocaleString("en-US")} G$` };
  }
  if (whole > SUPPORT_MAX_WHOLE) {
    return { ok: false, error: `Maximum is ${SUPPORT_MAX_WHOLE.toLocaleString("en-US")} G$` };
  }
  return { ok: true, wei, whole };
}

/** Wei string/bigint → whole G$ number (display only). */
export function weiToWhole(wei: string | bigint | null | undefined): number {
  if (wei == null) return 0;
  try {
    const v = typeof wei === "bigint" ? wei : BigInt(String(wei).split(".")[0] || "0");
    return Number(v / 10n ** 16n) / 100;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Support milestones
// ---------------------------------------------------------------------------
export const SUPPORT_MILESTONES_WHOLE = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;
export const SUPPORTER_MILESTONES = [5, 10, 25, 50, 100] as const;

/**
 * Milestone keys reached at this total / supporter count. Stable strings,
 * stored once per Delulu. (The first supporter has its own notification.)
 */
export function reachedSupportMilestones(totalWei: bigint, supporterCount: number): string[] {
  const out: string[] = [];
  for (const m of SUPPORT_MILESTONES_WHOLE) {
    if (totalWei >= BigInt(m) * WEI_PER_WHOLE) out.push(`total_${m}`);
  }
  for (const m of SUPPORTER_MILESTONES) {
    if (supporterCount >= m) out.push(`supporters_${m}`);
  }
  return out;
}

export function milestoneLabel(key: string): string {
  const total = /^total_(\d+)$/.exec(key);
  if (total) return `${Number(total[1]).toLocaleString("en-US")} G$ in support`;
  const people = /^supporters_(\d+)$/.exec(key);
  if (people) return `${people[1]} supporters`;
  return key;
}
