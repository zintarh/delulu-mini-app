/**
 * Player level from total points. Each level costs 500 more points than the
 * last (level 2 at 1,000, level 3 at 2,500, level 4 at 4,500, …).
 */
export function getLevel(points: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  let floor = 0;
  let cost = 1000;
  while (points >= floor + cost) {
    floor += cost;
    level += 1;
    cost += 500;
  }
  return { level, current: floor, next: floor + cost, progress: (points - floor) / cost };
}

/** 18400 → "18.4K", 2450 → "2,450". */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(n).toLocaleString("en-US");
}
