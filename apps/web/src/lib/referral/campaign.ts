/**
 * The referral reward campaign window — the single switch for referrals.
 *
 * Outside [START, END] nothing is credited (points or G$), RewardVault pays
 * out no referral G$, and the Rewards page shows no invite link. Sign-ups
 * through an old referral link keep working (profiles.referred_by is still
 * recorded); they just earn nothing.
 *
 * Inside the window, only referrals *made during it* count: the referee must
 * have signed up on/after START (evaluate.ts), and only credits from on/after
 * START are paid (payout.ts). So re-opening referrals never pays out credits
 * held from a previous campaign, or friends who signed up between campaigns.
 *
 * To run the next campaign: set both dates (WAT, +01:00) and deploy.
 *
 * Shared by server (evaluate/payout/gift) and client (Rewards card,
 * /referrals), so keep it free of server-only imports.
 */
// Last campaign: Sep 11 → Sep 29 2026 (ended early; was 23:59 WAT).
export const REFERRAL_CAMPAIGN_START_ISO = "2026-09-11T00:00:00+01:00";
export const REFERRAL_CAMPAIGN_END_ISO = "2026-09-29T14:45:00+01:00";

/** G$ paid per counted referral. */
export const REFERRAL_GDOLLARS_REWARD = 6000;

const START_MS = Date.parse(REFERRAL_CAMPAIGN_START_ISO);
const END_MS = Date.parse(REFERRAL_CAMPAIGN_END_ISO);

/** Referrals are being credited and paid right now. */
export function isReferralCampaignLive(now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= START_MS && t <= END_MS;
}

/** Not running — either ended or the next one hasn't started yet. */
export function isReferralCampaignOver(now: Date = new Date()): boolean {
  return !isReferralCampaignLive(now);
}

/** Whether a timestamp (sign-up, credit) falls on/after the current campaign's start. */
export function isInCurrentReferralCampaign(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= START_MS;
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
