/**
 * When the current forfeit period opens for proof, in unix seconds — or null
 * when it's already open. Mirrors ForfeitMarket._requirePeriodOpen: period 0
 * is open from creation; every later period opens `periodSeconds` before its
 * deadline. Without this, proving day N right before its deadline instantly
 * opened day N+1, so one sitting could cover two days.
 */
export function periodOpensAt(
  chain: { currentPeriodIndex: number | string; currentPeriodDeadline: number | string | bigint; periodSeconds?: number | string | bigint | null },
  nowSec: number = Math.floor(Date.now() / 1000),
): number | null {
  const index = Number(chain.currentPeriodIndex);
  const deadline = Number(chain.currentPeriodDeadline);
  const period = Number(chain.periodSeconds ?? 0);
  if (!(index > 0) || !(period > 0) || !Number.isFinite(deadline)) return null;
  const opens = deadline - period;
  return nowSec < opens ? opens : null;
}
