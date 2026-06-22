import type { City, CityIntelligence, GridResponse, ZoneForecast } from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}${body ? ` — ${body.slice(0, 140)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  base: BASE,
  cities: () => get<City[]>("/api/cities"),
  intelligence: (cid: string) => get<CityIntelligence>(`/api/cities/${cid}/intelligence`),
  grid: (cid: string, layer: string, horizon: number) =>
    get<GridResponse>(`/api/cities/${cid}/grid?layer=${layer}&horizon=${horizon}`),
  zoneForecast: (cid: string, zid: string) =>
    get<ZoneForecast>(`/api/cities/${cid}/zones/${zid}/forecast?hours=72`),
  enforcementBrief: (cid: string, zid: string) =>
    get<{ zone_id: string; generated_by: string; brief: string }>(
      `/api/cities/${cid}/enforcement/${zid}/brief`,
    ),
};
