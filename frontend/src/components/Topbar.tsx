"use client";

import clsx from "clsx";
import { useCity } from "@/lib/cityStore";
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

export default function Topbar() {
  const { cities, cityId, setCityId, intel } = useCity();
  const h = intel?.health;
  const worst = intel?.attributions?.length
    ? intel.attributions.reduce((a, b) => (b.aqi > a.aqi ? b : a))
    : null;
  const skill = intel?.metrics?.horizons?.[0]?.improvement_pct;
  const severe = intel?.alerts?.filter((a) => a.level === "severe").length ?? 0;

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900/70 px-4 backdrop-blur">
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg bg-ink-850/60 p-1">
        {cities.map((c) => (
          <button
            key={c.id}
            onClick={() => setCityId(c.id)}
            className={clsx(
              "whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
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
