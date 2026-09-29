/**
 * The referral reward campaign's hard end. After this instant no new referral
 * is credited and RewardVault pays out no referral G$ — not even retries of
 * credits earned earlier. Sign-ups through a referral link keep working
 * (profiles.referred_by is still recorded); they just no longer earn anything.
 * Shared by server (evaluate/payout) and client (banners), so keep it free of
 * server-only imports.
 */
export const REFERRAL_CAMPAIGN_END_ISO = "2026-09-29T23:59:59+01:00";

const END_MS = Date.parse(REFERRAL_CAMPAIGN_END_ISO);

export function isReferralCampaignOver(now: Date = new Date()): boolean {
  return now.getTime() > END_MS;
}

/** "today" / "tomorrow" / "Sep 29" — relative to the campaign's own timezone (WAT). */
export function referralCampaignEndLabel(now: Date = new Date()): string {
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
  const end = new Date(END_MS);
  if (day(now) === day(end)) return "today";
  if (day(new Date(now.getTime() + 24 * 60 * 60 * 1000)) === day(end)) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", month: "short", day: "numeric" }).format(end);
}
