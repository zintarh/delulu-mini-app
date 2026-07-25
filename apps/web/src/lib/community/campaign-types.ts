export const PRIZE_WINNER_COUNTS = [5, 10, 20] as const;
export type PrizeWinnerCount = (typeof PRIZE_WINNER_COUNTS)[number];

export const CAMPAIGN_DURATION_OPTIONS = [7, 14, 30, 60] as const;
export type CampaignDurationDays = (typeof CAMPAIGN_DURATION_OPTIONS)[number];

export const PROOF_TYPES = ["screenshot", "live_camera"] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export const LIVE_CAMERA_DURATION_MINUTES = [1, 2, 3, 4, 5] as const;
export type LiveCameraDurationMinutes = (typeof LIVE_CAMERA_DURATION_MINUTES)[number];

export function parseProofType(value: unknown): ProofType {
  return value === "live_camera" ? "live_camera" : "screenshot";
}

// Accepts minutes (1-5); returns seconds, defaulting to 60 (1 minute) for invalid input.
export function parseLiveCameraDurationSeconds(value: unknown): number {
  const n = Number(value);
  const minutes = (LIVE_CAMERA_DURATION_MINUTES as readonly number[]).includes(n) ? n : 1;
  return minutes * 60;
}

export const PARTICIPATING_STATUSES = ["approved", "active"] as const;
export type ParticipatingCampaignStatus = (typeof PARTICIPATING_STATUSES)[number];

export function isCampaignParticipatable(status: string): status is ParticipatingCampaignStatus {
  return (PARTICIPATING_STATUSES as readonly string[]).includes(status);
}

export function isCampaignFunded(status: string): boolean {
  return status === "active";
}

export type HomeCampaignFeedSection = "joined" | "ongoing";

export function parseHomeCampaignFeedSection(value: string | null): HomeCampaignFeedSection {
  if (value === "joined" || value === "yours") return "joined";
  return "ongoing";
}

export function isCampaignEndedByDate(displayEndsAt: string | null): boolean {
  if (!displayEndsAt) return false;
  return new Date(displayEndsAt).getTime() <= Date.now();
}

/**
 * `display_ends_at` is only populated once an admin confirms funding or
 * milestones for a campaign (see confirm-fund/confirm-milestones routes) —
 * an approved campaign that never goes through either step keeps
 * `display_ends_at: null` forever, even though it's live and running against
 * its stated duration. Falls back to created_at + duration_days so joining
 * and the join-limit count still respect the campaign's actual end date.
 */
export function isCampaignExpired(campaign: {
  display_ends_at: string | null;
  created_at?: string | null;
  duration_days?: number | null;
}): boolean {
  if (campaign.display_ends_at) return isCampaignEndedByDate(campaign.display_ends_at);
  if (!campaign.created_at || !campaign.duration_days) return false;
  return isCampaignEndedByDate(
    computeDisplayEndsAt(campaign.duration_days, new Date(campaign.created_at)),
  );
}

export function computeDisplayEndsAt(durationDays: number, from = new Date()): string {
  const ends = new Date(from);
  ends.setDate(ends.getDate() + durationDays);
  return ends.toISOString();
}

export type CommunityCampaignFeedItem = {
  id: string;
  title: string;
  status: string;
  is_funded: boolean;
  proposed_pool_amount: number;
  proof_cadence: string;
  duration_days: number;
  prize_winner_count: number;
  cover_image_url: string | null;
  display_ends_at: string | null;
  on_chain_challenge_id: number | null;
  community: { id: string; name: string; slug: string };
  participant_state: "none" | "joined";
  is_free_to_join?: boolean;
  join_token?: string | null;
  join_amount?: number | null;
  forfeit_pct?: number | null;
  proof_instructions?: string | null;
  proof_type?: string;
  live_camera_duration_seconds?: number | null;
  myStreak?: number;
  myPoints?: number;
  milestone_count?: number;
  can_join?: boolean;
  participant_count?: number;
  participant_avatars?: { address: string; username: string | null; pfpUrl: string | null }[];
  telegram_link?: string | null;
};

export function encodeFeedCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

export function decodeFeedCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.lastIndexOf("|");
    if (sep <= 0) return null;
    return { createdAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
  } catch {
    return null;
  }
}

export function parsePrizeWinnerCount(value: unknown): PrizeWinnerCount {
  const n = Number(value);
  if (n === 5 || n === 10 || n === 20) return n;
  return 10;
}

export function parseDurationDays(value: unknown): CampaignDurationDays {
  const n = Number(value);
  if (n === 7 || n === 14 || n === 30 || n === 60) return n;
  return 30;
}
