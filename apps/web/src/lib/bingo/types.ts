import { z } from "zod";

export const DAY_MS = 86_400_000;

/** Bonus squares' free on-chain campaigns are tier rows keyed by their square. */
export const bonusTierKey = (squareIndex: number) => `bonus_${squareIndex}`;
export const isBonusTier = (tierKey: string) => tierKey.startsWith("bonus_");

/** Forfeit % per missed day the contract accepts (CommunityMarketV1.setCommunityCampaignEconomics). */
export const FORFEIT_PCT_OPTIONS = [0, 2, 5, 10] as const;

export const missionSchema = z
  .object({
    title: z.string().trim().min(3).max(60),
    /** Bonus squares fill with a photo but never affect the stake. */
    bonus: z.boolean().default(false),
  })
  .strict();

export const tierSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,19}$/),
    label: z.string().trim().min(2).max(20),
    stake: z.number().int().min(1).max(10_000_000),
    forfeitPct: z.union([z.literal(0), z.literal(2), z.literal(5), z.literal(10)]),
    /** G$ per approved daily photo on this tier; unset = the Rewards Engine's global daily amount. */
    rewardPerSquare: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

export type BingoMission = z.infer<typeof missionSchema>;
export type BingoTier = z.infer<typeof tierSchema>;

/** 7-day: 7 required (one a day) + up to 2 bonus on a 3×3. 3-day: exactly 3 required. */
export function versionSchemaFor(durationDays: 3 | 7) {
  return z
    .object({
      missions: z.array(missionSchema).min(durationDays).max(durationDays === 7 ? 9 : 3),
      tiers: z.array(tierSchema).min(1).max(3),
    })
    .superRefine((v, ctx) => {
      const required = v.missions.filter((m) => !m.bonus).length;
      if (required !== durationDays) {
        ctx.addIssue({ code: "custom", message: `Needs exactly ${durationDays} required missions (one per day).` });
      }
      if (new Set(v.tiers.map((t) => t.key)).size !== v.tiers.length) {
        ctx.addIssue({ code: "custom", message: "Tier keys must be unique." });
      }
    });
}

export type BingoCampaignRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  duration_days: 3 | 7;
  enrollment: "fixed" | "rolling";
  recurrence: "one_time" | "automatic" | "manual";
  status: "draft" | "live" | "paused" | "archived";
  current_version_id: string | null;
  sort_order: number;
};

export type BingoVersionRow = {
  id: string;
  campaign_id: string;
  version: number;
  missions: BingoMission[];
  tiers: BingoTier[];
};

export type BingoCycleRow = {
  id: string;
  campaign_id: string;
  version_id: string;
  cycle_number: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "setting_up" | "ready" | "failed" | "ending" | "archived" | "cancelled";
  last_error: string | null;
};

export type BingoCycleTierRow = {
  id: string;
  cycle_id: string;
  tier_key: string;
  label: string;
  stake_amount: number;
  forfeit_pct: number;
  community_campaign_id: string | null;
  on_chain_challenge_id: number | null;
  setup_step: "pending" | "created" | "economics_set" | "ready";
  sort_order: number;
};

export type BingoAttemptRow = {
  id: string;
  campaign_id: string;
  version_id: string;
  cycle_id: string | null;
  cycle_tier_id: string | null;
  tier_key: string;
  wallet: string;
  stake_amount: number;
  /** Rolling attempts: the player's ForfeitMarket commitment (on-chain id). */
  forfeit_commitment_id: number | null;
  started_at: string;
  ends_at: string;
  status: "active" | "completed" | "finished" | "left";
  squares_filled: number;
  required_filled: number;
  last_filled_at: string | null;
};

export type BingoSquareRow = {
  id: string;
  attempt_id: string;
  square_index: number;
  mission_title: string;
  bonus: boolean;
  slot_index: number | null;
  proof_url: string;
  status: "confirming" | "filled";
  filled_at: string | null;
};

/** A cycle is joinable from setup until its last day closes. */
export type CyclePhase = "upcoming" | "live" | "ended";

export function cyclePhase(cycle: Pick<BingoCycleRow, "starts_at" | "ends_at">, nowMs = Date.now()): CyclePhase {
  if (nowMs < Date.parse(cycle.starts_at)) return "upcoming";
  if (nowMs >= Date.parse(cycle.ends_at)) return "ended";
  return "live";
}

/** Day slot (0-based) `nowMs` falls in, or null outside the window. */
export function daySlot(startsAt: string, endsAt: string, nowMs = Date.now()): number | null {
  const start = Date.parse(startsAt);
  if (nowMs < start || nowMs >= Date.parse(endsAt)) return null;
  return Math.floor((nowMs - start) / DAY_MS);
}

/** Midnight in Africa/Lagos (UTC+1, no DST) for a calendar date "YYYY-MM-DD" — the rewards day boundary. */
export function lagosMidnight(date: string): Date {
  return new Date(`${date}T00:00:00+01:00`);
}

/**
 * Rolling attempt (one Forfeit commitment, one period per day): a day that
 * closed without its square means the contract forfeits the stake and the
 * attempt is over — it can't be continued, only restarted.
 */
export function rollingMissedDay(
  a: { started_at: string; required_filled: number },
  nowMs = Date.now(),
): boolean {
  return nowMs >= Date.parse(a.started_at) + (a.required_filled + 1) * DAY_MS;
}

export function rollingAttemptOver(
  a: { started_at: string; ends_at: string; required_filled: number },
  durationDays: number,
  nowMs = Date.now(),
): boolean {
  return a.required_filled >= durationDays || nowMs >= Date.parse(a.ends_at) || rollingMissedDay(a, nowMs);
}

const LAGOS_OFFSET_MS = 60 * 60_000;

/** The first Lagos midnight strictly after `nowMs`. */
export function nextLagosMidnight(nowMs = Date.now()): Date {
  const lagosDay = Math.floor((nowMs + LAGOS_OFFSET_MS) / DAY_MS) + 1;
  return new Date(lagosDay * DAY_MS - LAGOS_OFFSET_MS);
}

export const isBingoMissionList = (v: unknown): v is BingoMission[] =>
  Array.isArray(v) && v.every((m) => missionSchema.safeParse(m).success);
