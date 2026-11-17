/** Bingo days run midnight to midnight in Lagos, the rewards timezone. */
const TZ = "Africa/Lagos";

export const fmtG = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });

/** "Wed 18 Nov" */
export function fmtDay(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

/** "18 – 24 Nov" (ends_at is exclusive: the last day is the one before it). */
export function fmtRange(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(Date.parse(endsAt) - 1);
  const sm = s.toLocaleDateString("en-GB", { month: "short", timeZone: TZ });
  const em = e.toLocaleDateString("en-GB", { month: "short", timeZone: TZ });
  const sd = s.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ });
  const ed = e.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ });
  return sm === em ? `${sd} – ${ed} ${em}` : `${sd} ${sm} – ${ed} ${em}`;
}

/** "5h 20m" / "2d 4h" until `iso`. */
export function fmtUntil(iso: string, nowMs = Date.now()) {
  const ms = Math.max(0, Date.parse(iso) - nowMs);
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}m`;
}
