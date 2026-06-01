/** Active delulu campaign length (leaderboard + weekly board). */
export const CAMPAIGN_DURATION_SEC = 14 * 24 * 60 * 60;

/** Tuesday = 2 (UTC). */
export function getMostRecentTuesdayUtc(from: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  const daysSinceTuesday = (day + 7 - 2) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceTuesday);
  return d;
}

/**
 * Current 2-week campaign window (starts Tuesday 00:00 UTC).
 * Delulus from campaign start through now (or campaign end, whichever is sooner).
 */
export function getActiveCampaignWindow(now: Date = new Date()) {
  const startDate = getMostRecentTuesdayUtc(now);
  const startTs = Math.floor(startDate.getTime() / 1000);
  const endTs = startTs + CAMPAIGN_DURATION_SEC;
  const nowTs = Math.floor(now.getTime() / 1000);

  return {
    campaignStart: String(startTs),
    campaignEnd: String(Math.min(nowTs, endTs)),
    campaignEndDate: new Date(endTs * 1000),
    campaignStartDate: startDate,
  };
}
