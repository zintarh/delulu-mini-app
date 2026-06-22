/** Build last N days of claim counts ending today (UTC). */
export function buildSparklineSeries(
  dailyCounts: { claim_date: string; claim_count: number }[],
  days = 30,
): number[] {
  const map = new Map<string, number>();
  for (const row of dailyCounts) {
    map.set(row.claim_date, row.claim_count);
  }

  const series: number[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push(map.get(key) ?? 0);
  }
  return series;
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sparklineStartDate(days = 30): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}
