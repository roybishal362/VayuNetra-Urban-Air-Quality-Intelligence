"use client";

import clsx from "clsx";
import Logo from "./Logo";
import type { City, CityIntelligence } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import { compact } from "@/lib/format";

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-display text-[15px] font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

export default function Topbar({
  cities, cityId, onCity, intel,
}: {
  cities: City[];
  cityId: string;
  onCity: (id: string) => void;
  intel: CityIntelligence | null;
}) {
  const h = intel?.health;
  const worst = intel?.attributions?.length
    ? intel.attributions.reduce((a, b) => (b.aqi > a.aqi ? b : a))
    : null;
  const skill = intel?.metrics?.horizons?.[0]?.improvement_pct;
  const severe = intel?.alerts?.filter((a) => a.level === "severe").length ?? 0;

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900/70 px-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-ink-850/70">
          <Logo size={22} />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight text-slate-100">VayuNetra</div>
          <div className="hidden text-[9px] uppercase tracking-[0.18em] text-slate-500 xl:block">
            Urban Air Quality Intelligence
          </div>
        </div>
      </div>

      <div className="ml-1 flex items-center gap-0.5 rounded-lg bg-ink-850/60 p-1">
        {cities.map((c) => (
          <button
            key={c.id}
            onClick={() => onCity(c.id)}
            className={clsx(
              "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
              c.id === cityId ? "bg-brand text-ink-950" : "text-slate-300 hover:bg-ink-700",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4 pr-1 sm:gap-5">
        {h && <Kpi label="City AQI" value={h.avg_aqi} color={aqiColor(h.avg_aqi)} />}
        {worst && <Kpi label="Worst" value={worst.aqi} color={aqiColor(worst.aqi)} />}
        {h && <Kpi label="Exposed" value={compact(h.exposed_population)} color="#F29C33" />}
        <Kpi label="Alerts" value={intel?.alerts?.length ?? "—"} color={severe ? "#E93F33" : undefined} />
        {skill != null && <Kpi label="Skill" value={`+${skill.toFixed(0)}%`} color="#34d399" />}
      </div>
    </header>
  );
}
