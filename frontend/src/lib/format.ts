export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
}

export function fmtTime(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime())
    ? ts
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
