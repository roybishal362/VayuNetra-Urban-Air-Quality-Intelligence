// Mirrors the backend pydantic schemas.
export interface LatLon { lat: number; lon: number }
export interface BBox { min_lat: number; min_lon: number; max_lat: number; max_lon: number }

export interface Zone { id: string; name: string; center: LatLon; population?: number; vulnerable_sites?: number }
export interface City {
  id: string; name: string; state: string; timezone: string;
  center: LatLon; bbox: BBox; grid_step_km: number; languages: string[]; zones: Zone[];
}

export interface GridCell { lat: number; lon: number; aqi: number; category: string; color: string }
export interface GridResponse {
  city_id: string; layer: string; horizon_h: number; step_km: number; now_ts: string; cells: GridCell[];
}

export interface ForecastPoint {
  ts: string; horizon_h: number; pm25: number; pm25_low?: number; pm25_high?: number;
  aqi: number; category: string; color: string;
}
export interface ZoneForecast { zone_id: string; issued_at: string; points: ForecastPoint[] }

export interface SourceContribution {
  source: string; label: string; pct: number; concentration: number; confidence: number; color: string;
}
export interface Evidence { signal: string; detail: string; points_to: string }
export interface ZoneAttribution {
  zone_id: string; zone_name: string; ts: string; pm25: number; aqi: number; category: string;
  dominant_source: string; dominant_label: string; overall_confidence: number;
  contributions: SourceContribution[]; evidence: Evidence[]; fires_upwind: number; fires_modeled: boolean;
}

export interface AdvisoryItem {
  zone_id: string; zone_name: string; horizon_h: number; peak_aqi: number; category: string; color: string;
  risk_level: string; headline: string; guidance: string[]; vulnerable_note: string;
  languages: Record<string, string>; generated_by: string;
}

export interface EnforcementItem {
  rank: number; zone_id: string; zone_name: string; priority: number;
  dominant_source: string; dominant_label: string; current_aqi: number; forecast_aqi_24h: number;
  trend: string; population_exposed: number; vulnerable_sites: number;
  recommended_action: string; evidence: string[]; confidence: number;
}

export interface HorizonMetric {
  horizon_h: number; rmse: number; mae: number;
  persistence_rmse: number; persistence_mae: number; improvement_pct: number;
}
export interface ForecastMetrics {
  city_id: string; target: string; trained_at: string; n_train: number; n_test: number;
  horizons: HorizonMetric[]; feature_importance: Record<string, number>;
}

export interface CityHealth {
  total_population: number; exposed_population: number; severe_population: number;
  vulnerable_sites_affected: number; avg_aqi: number; worst_category: string; note: string;
}
export interface Alert {
  zone_id: string; zone_name: string; level: string; aqi: number; horizon_h: number; message: string;
}
export interface LandUse { industrial: LatLon[]; roads: LatLon[]; }

export interface HistoryPoint { ts: string; pm25: number; aqi: number; category: string; color: string }
export interface ZoneHistory { zone_id: string; now_ts: string; points: HistoryPoint[] }

export interface SimulationResult {
  zone_id: string; zone_name: string; source: string; source_label: string; reduction: number;
  original_pm25: number; new_pm25: number; original_aqi: number; new_aqi: number; delta_aqi: number;
  new_category: string; new_color: string;
}

export interface CityIntelligence {
  city_id: string; city_name: string; generated_at: string; now_ts: string; data_source: string;
  summary: string; forecasts: ZoneForecast[]; attributions: ZoneAttribution[];
  enforcement: EnforcementItem[]; advisories: AdvisoryItem[]; metrics?: ForecastMetrics;
  landuse?: LandUse; health?: CityHealth; alerts: Alert[];
}
