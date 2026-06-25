import type {
  City, CityComparison, CityIntelligence, GridResponse, SimulationResult, ZoneForecast, ZoneHistory,
  AttributionValidation, EnforcementRoi, HealthCost,
} from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  // Honor the backend's Cache-Control (short max-age + stale-while-revalidate) so repeat
  // requests are served from the browser cache instantly instead of re-hitting the network.
  // 45s timeout tolerates a free-tier backend cold start (Render spins down when idle).
  const res = await fetch(`${BASE}${path}`, { cache: "default", signal: AbortSignal.timeout(45000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}${body ? ` — ${body.slice(0, 140)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  base: BASE,
  cities: () => get<City[]>("/api/cities"),
  compare: () => get<CityComparison[]>("/api/compare"),
  intelligence: (cid: string) => get<CityIntelligence>(`/api/cities/${cid}/intelligence`),
  grid: (cid: string, layer: string, horizon: number) =>
    get<GridResponse>(`/api/cities/${cid}/grid?layer=${layer}&horizon=${horizon}`),
  zoneForecast: (cid: string, zid: string) =>
    get<ZoneForecast>(`/api/cities/${cid}/zones/${zid}/forecast?hours=72`),
  zoneHistory: (cid: string, zid: string, hours = 48) =>
    get<ZoneHistory>(`/api/cities/${cid}/zones/${zid}/history?hours=${hours}`),
  simulate: (cid: string, zid: string, source: string, reduction: number) =>
    get<SimulationResult>(
      `/api/cities/${cid}/zones/${zid}/simulate?source=${source}&reduction=${reduction}`,
    ),
  briefing: (cid: string) =>
    get<{ generated_by: string; briefing: string }>(`/api/cities/${cid}/briefing`),
  attributionValidation: (cid: string) =>
    get<AttributionValidation>(`/api/cities/${cid}/attribution-validation`),
  enforcementRoi: (cid: string, inspectors: number) =>
    get<EnforcementRoi>(`/api/cities/${cid}/enforcement/roi?inspectors=${inspectors}`),
  healthCost: (cid: string) => get<HealthCost>(`/api/cities/${cid}/health-cost`),
  enforcementBrief: (cid: string, zid: string) =>
    get<{ zone_id: string; generated_by: string; brief: string }>(
      `/api/cities/${cid}/enforcement/${zid}/brief`,
    ),
};
