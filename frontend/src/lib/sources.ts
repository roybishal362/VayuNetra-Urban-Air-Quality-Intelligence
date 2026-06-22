export const SOURCE_COLOR: Record<string, string> = {
  vehicular: "#4F86C6",
  industrial: "#8E44AD",
  biomass_burning: "#E67E22",
  dust_construction: "#C2956E",
  secondary: "#16A085",
};

export function sourceColor(key: string): string {
  return SOURCE_COLOR[key] ?? "#94a3b8";
}

export const FEATURE_LABEL: Record<string, string> = {
  tgt_blh: "Boundary-layer height",
  tgt_hour_sin: "Hour of day",
  tgt_hour_cos: "Hour of day",
  tgt_dow: "Day of week",
  tgt_is_weekend: "Weekend",
  tgt_month: "Season (month)",
  tgt_wind_speed: "Wind speed",
  tgt_wind_sin: "Wind direction",
  tgt_wind_cos: "Wind direction",
  tgt_humidity: "Humidity",
  tgt_temp_c: "Temperature",
  tgt_precip: "Precipitation",
  lat: "Location (lat)",
  lon: "Location (lon)",
  cur_pm25: "Current PM2.5",
  cur_pm25_roll24: "PM2.5 (24h mean)",
  cur_pm10: "Current PM10",
  cur_no2: "Current NO₂",
  horizon_h: "Lead time",
};

export function featureLabel(key: string): string {
  return FEATURE_LABEL[key] ?? key;
}
