// CPCB National AQI bands (kept in sync with backend domain/aqi.py).
export const AQI_BANDS = [
  { max: 50, label: "Good", color: "#55A84F" },
  { max: 100, label: "Satisfactory", color: "#A3C853" },
  { max: 200, label: "Moderate", color: "#FFF833" },
  { max: 300, label: "Poor", color: "#F29C33" },
  { max: 400, label: "Very Poor", color: "#E93F33" },
  { max: 9999, label: "Severe", color: "#AF2D24" },
];

export function aqiBand(aqi: number) {
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

export function aqiColor(aqi: number): string {
  return aqiBand(aqi).color;
}

/** Readable text colour over an AQI swatch (dark text on light yellow/green). */
export function textOn(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 150 ? "#0b1120" : "#ffffff";
}

export function trendArrow(trend: string): string {
  return trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→";
}
