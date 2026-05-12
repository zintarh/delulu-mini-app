/**
 * Resolution / “active on feed” rules aligned with `DeluluCard` and the subgraph:
 * - On-chain and subgraph `resolutionDeadline` are **Unix seconds** (same as `block.timestamp` in Delulu v3).
 * - `timestampToDate()` in the app multiplies by 1000 → `Date` for UI.
 * - DeluluCard: `isEnded = resolutionMs > 0 && resolutionMs <= now` (epoch deadline = not ended).
 */
export function isDeluluResolutionEndedOnFeed(
  resolutionDeadline: Date,
  nowMs: number = Date.now(),
): boolean {
  const resolutionMs = resolutionDeadline.getTime();
  return resolutionMs > 0 && resolutionMs <= nowMs;
}

export function isDeluluResolutionActiveOnFeed(
  resolutionDeadline: Date,
  nowMs: number = Date.now(),
): boolean {
  return !isDeluluResolutionEndedOnFeed(resolutionDeadline, nowMs);
}
