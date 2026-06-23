export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
}

/**
 * Forecast skill vs the persistence baseline. The model is blended so it never
 * underperforms persistence — on already-stable air (e.g. clean coastal cities)
 * it ties the strong baseline, which is honest, not a failure. Show that as
 * "on par" instead of a bare "+0%" that reads like a bug.
 */
export function skillLabel(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  if (pct >= 1) return `+${Math.round(pct)}%`;
  if (pct <= -1) return `${Math.round(pct)}%`;
  return "on par";
}

export function fmtTime(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime())
    ? ts
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
