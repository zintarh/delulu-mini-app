export const PRIZE_WINNER_COUNTS = [5, 10, 20] as const;
export type PrizeWinnerCount = (typeof PRIZE_WINNER_COUNTS)[number];

export const CAMPAIGN_DURATION_OPTIONS = [7, 14, 30, 60] as const;
export type CampaignDurationDays = (typeof CAMPAIGN_DURATION_OPTIONS)[number];

export const PARTICIPATING_STATUSES = ["approved", "active"] as const;
export type ParticipatingCampaignStatus = (typeof PARTICIPATING_STATUSES)[number];

export function isCampaignParticipatable(status: string): status is ParticipatingCampaignStatus {
  return (PARTICIPATING_STATUSES as readonly string[]).includes(status);
}

export function isCampaignFunded(status: string): boolean {
  return status === "active";
}

export function canClaimCampaignPrize(isCommunityMember: boolean): boolean {
  return isCommunityMember;
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
  myStreak?: number;
  myPoints?: number;
  milestone_count?: number;
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
