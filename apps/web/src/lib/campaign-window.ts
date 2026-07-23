/** Active delulu campaign length (leaderboard + weekly board). */
const CAMPAIGN_DURATION_SEC = 14 * 24 * 60 * 60;

/**
 * First Tuesday 00:00 UTC of a biweekly cadence. Override with
 * `NEXT_PUBLIC_CAMPAIGN_EPOCH` (ISO 8601) to align with a launch date.
 * Default: 2026-05-12 (periods May 12–26, May 26–Jun 9, …).
 */
function getCampaignEpochUtc(): Date {
  const raw = process.env.NEXT_PUBLIC_CAMPAIGN_EPOCH?.trim();
  const parsed = raw ? new Date(raw) : new Date(Date.UTC(2026, 4, 12));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(2026, 4, 12));
  }
  return snapToTuesdayUtc(parsed);
}

function snapToTuesdayUtc(from: Date): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  const daysSinceTuesday = (day + 7 - 2) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceTuesday);
  return d;
}

/**
 * Current 2-week campaign window (aligned to biweekly periods from epoch).
 * Does not reset every Tuesday — only when a full 14-day period ends.
 */
export function getActiveCampaignWindow(now: Date = new Date()) {
  const epoch = getCampaignEpochUtc();
  const epochTs = Math.floor(epoch.getTime() / 1000);
  const nowTs = Math.floor(now.getTime() / 1000);

  const periodIndex = Math.floor(
    Math.max(0, nowTs - epochTs) / CAMPAIGN_DURATION_SEC,
  );
  const startTs = epochTs + periodIndex * CAMPAIGN_DURATION_SEC;
  const endTs = startTs + CAMPAIGN_DURATION_SEC;

  return {
    campaignStart: String(startTs),
    campaignEnd: String(Math.min(nowTs, endTs)),
    campaignEndDate: new Date(endTs * 1000),
    campaignStartDate: new Date(startTs * 1000),
  };
}
