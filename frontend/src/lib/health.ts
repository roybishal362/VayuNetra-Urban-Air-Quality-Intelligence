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
  safe: string; // reassurance phrase, used when the air is clean for this person
  risk: string; // why this person is more vulnerable, used when the air is poor
}

export const GROUPS: Group[] = [
  { id: "healthy", label: "Healthy adult", mult: 1.0, safe: "you're good to go", risk: "even healthy lungs feel pollution this high" },
  { id: "child", label: "Child", mult: 1.6, safe: "fine for kids to play outside", risk: "children breathe faster and are hit harder" },
  { id: "elderly", label: "Elderly 65+", mult: 1.7, safe: "comfortable for you today", risk: "older hearts and lungs are more vulnerable" },
  { id: "respiratory", label: "Asthma / heart / lung", mult: 2.2, safe: "your airways should be comfortable", risk: "this can trigger asthma, COPD or heart symptoms" },
  { id: "outdoor", label: "Outdoor worker", mult: 1.8, safe: "fine for a full shift outdoors", risk: "long outdoor hours mean heavy cumulative exposure" },
  { id: "pregnant", label: "Pregnant", mult: 1.5, safe: "safe for you and your baby today", risk: "pollution can affect your baby's development" },
];

export interface Advice {
  level: string;
  color: string;
  summary: string;   // one dynamic line: group-specific AND AQI-specific
  actions: string[];
}

/**
 * Personalised guidance: the ward AQI weighted by the group's sensitivity decides the band,
 * and BOTH the summary line and the actions change with it — so a pregnant person reads a
 * reassuring line at clean air and an urgent one when it's severe (and likewise per group).
 */
export function personalAdvice(aqi: number, group: Group): Advice {
  const eff = aqi * group.mult;
  if (eff <= 100) return {
    level: "Low risk", color: "#55A84F",
    summary: `Air is clean right now — ${group.safe}. No special precautions needed.`,
    actions: ["Normal outdoor activity is fine."],
  };
  if (eff <= 200) return {
    level: "Moderate", color: "#FFF833",
    summary: `Mostly fine, but ${group.risk}, so go easy on hard outdoor exertion.`,
    actions: ["Limit prolonged or heavy outdoor exertion.", "Keep reliever medication handy if you use one."],
  };
  if (eff <= 300) return {
    level: "High", color: "#F29C33",
    summary: `Unhealthy for you — ${group.risk}. Cut outdoor time and mask up.`,
    actions: ["Avoid outdoor exercise; keep time outside short.", "Wear a well-fitted N95 outdoors.", "Run an air purifier indoors; keep windows shut."],
  };
  if (eff <= 400) return {
    level: "Very high", color: "#E93F33",
    summary: `Very unhealthy — ${group.risk}. Stay indoors; N95 if you must step out.`,
    actions: ["Stay indoors as much as possible.", "N95 is essential outdoors.", "Purifier on; seal windows.", "Watch for breathing or chest symptoms."],
  };
  return {
    level: "Severe — act now", color: "#AF2D24",
    summary: `Hazardous for you — ${group.risk}. Stay indoors and avoid all exposure.`,
    actions: ["Do not go outdoors unless essential.", "N95 mandatory; minimise time outside.", "Purifier on max; make one clean room.", "Seek care for any breathing distress."],
  };
}
