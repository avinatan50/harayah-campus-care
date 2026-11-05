// Pure helpers for hidden periodic maintenance cycles.
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

/** Start date (YYYY-MM-DD) of the cycle containing `today`, counted from the anchor in steps of intervalMonths. */
export function currentCycleStart(anchor: string, intervalMonths: number, today: Date = new Date()): string {
  const [y, m, d] = anchor.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let months = (t.getUTCFullYear() - y) * 12 + (t.getUTCMonth() - (m - 1));
  if (t.getUTCDate() < d) months -= 1;
  const k = Math.max(0, Math.floor(months / intervalMonths));
  return ymd(new Date(Date.UTC(y, m - 1 + k * intervalMonths, d)));
}

export function nextCycleStart(cycleStart: string, intervalMonths: number): string {
  const [y, m, d] = cycleStart.split("-").map(Number) as [number, number, number];
  return ymd(new Date(Date.UTC(y, m - 1 + intervalMonths, d)));
}

export function progress(done: number, total: number) { return total ? Math.round((done / total) * 100) : 0; }

export const INTERVAL_LABELS: Record<number, string> = { 1: "חודשי", 3: "רבעוני", 6: "חצי-שנתי", 12: "שנתי" };
