// Public-health translations of PM2.5 — grounded, clearly-labelled estimates.

/**
 * Berkeley Earth (R. Muller, 2015): breathing ~22 µg/m³ of PM2.5 for 24h is roughly
 * equivalent to smoking one cigarette. So cigarettes/day ≈ PM2.5 / 22.
 */
export function cigarettesPerDay(pm25: number): number {
  return Math.max(0, pm25 / 22);
}

/**
 * Short-term PM2.5 mortality: ~0.65% rise in daily all-cause mortality per 10 µg/m³
 * (Liu et al., NEJM 2019; WHO AQG 2021), relative to the WHO 24-hour guideline (15 µg/m³).
 * Returns the excess daily mortality risk in %, clamped at 0.
 */
export function shortTermMortalityRiskPct(pm25: number): number {
  return Math.max(0, ((pm25 - 15) / 10) * 0.65);
}

export interface Group {
  id: string;
  label: string;
  mult: number; // sensitivity weighting (heuristic) used to shift the personal risk band
  hint: string;
}

// `hint` describes why the group is weighted more sensitive — NOT a statement that there is
// risk right now. The actual verdict comes from personalAdvice(), which scales with the live
// AQI (so at clean air every group reads "Low risk").
export const GROUPS: Group[] = [
  { id: "healthy", label: "Healthy adult", mult: 1.0, hint: "no added sensitivity" },
  { id: "child", label: "Child", mult: 1.6, hint: "developing lungs; breathe more air per kg" },
  { id: "elderly", label: "Elderly 65+", mult: 1.7, hint: "more sensitive heart & lungs" },
  { id: "respiratory", label: "Asthma / heart / lung", mult: 2.2, hint: "a condition that reacts to pollution" },
  { id: "outdoor", label: "Outdoor worker", mult: 1.8, hint: "long hours outdoors with exertion" },
  { id: "pregnant", label: "Pregnant", mult: 1.5, hint: "extra caution worthwhile when air is poor" },
];

export interface Advice {
  level: string;
  color: string;
  actions: string[];
}

/** Personalised guidance from the ward AQI weighted by group sensitivity (a heuristic, labelled as guidance). */
export function personalAdvice(aqi: number, mult: number): Advice {
  const eff = aqi * mult;
  if (eff <= 100) return { level: "Low risk", color: "#55A84F", actions: ["Normal outdoor activity is fine."] };
  if (eff <= 200) return { level: "Moderate", color: "#FFF833", actions: ["Limit prolonged or heavy outdoor exertion.", "Keep reliever medication handy if you use one."] };
  if (eff <= 300) return { level: "High", color: "#F29C33", actions: ["Avoid outdoor exercise; keep time outside short.", "Wear a well-fitted N95 outdoors.", "Run an air purifier indoors; keep windows shut."] };
  if (eff <= 400) return { level: "Very high", color: "#E93F33", actions: ["Stay indoors as much as possible.", "N95 is essential outdoors.", "Purifier on; seal windows.", "Watch for breathing or chest symptoms."] };
  return { level: "Severe — act now", color: "#AF2D24", actions: ["Do not go outdoors unless essential.", "N95 mandatory; minimise time outside.", "Purifier on max; make one clean room.", "Seek care for any breathing distress."] };
}
