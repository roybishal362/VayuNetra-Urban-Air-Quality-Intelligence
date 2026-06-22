"use client";

import type { CityIntelligence } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import { compact } from "@/lib/format";

function Tile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="card flex min-w-[110px] flex-1 flex-col justify-center px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-lg font-semibold leading-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function KpiStrip({ intel }: { intel: CityIntelligence }) {
  const h = intel.health;
  const worst = intel.attributions.length
    ? intel.attributions.reduce((a, b) => (b.aqi > a.aqi ? b : a))
    : null;
  const skill = intel.metrics?.horizons?.[0]?.improvement_pct;
  const severe = intel.alerts.filter((a) => a.level === "severe").length;

  return (
    <div className="flex flex-shrink-0 gap-2 border-b border-ink-700 bg-ink-900/40 px-4 py-2">
      <Tile label="City AQI" value={h?.avg_aqi ?? "—"} sub={h?.worst_category} accent={h ? aqiColor(h.avg_aqi) : undefined} />
      <Tile label="Worst ward" value={worst ? worst.aqi : "—"} sub={worst?.zone_name} accent={worst ? aqiColor(worst.aqi) : undefined} />
      <Tile label="People exposed" value={h ? compact(h.exposed_population) : "—"} sub="Poor air or worse" accent="#F29C33" />
      <Tile label="Vulnerable sites" value={h?.vulnerable_sites_affected ?? "—"} sub="schools · hospitals" />
      <Tile label="Active alerts" value={intel.alerts.length} sub={severe ? `${severe} severe` : "monitored"} accent={severe ? "#E93F33" : undefined} />
      <Tile label="Forecast skill" value={skill != null ? `+${skill.toFixed(0)}%` : "—"} sub="vs persistence" accent="#34d399" />
    </div>
  );
}
