"use client";

import clsx from "clsx";
import Logo from "./Logo";
import type { City, CityIntelligence } from "@/lib/types";

export default function Topbar({
  cities, cityId, onCity, intel,
}: {
  cities: City[];
  cityId: string;
  onCity: (id: string) => void;
  intel: CityIntelligence | null;
}) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-900/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-ink-850/80 shadow-lg">
          <Logo size={22} />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight text-slate-100">VayuNetra</div>
          <div className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">
            Urban Air Quality Intelligence
          </div>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-1 rounded-lg bg-ink-800 p-1">
        {cities.map((c) => (
          <button
            key={c.id}
            onClick={() => onCity(c.id)}
            className={clsx(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              c.id === cityId ? "bg-brand text-ink-950" : "text-slate-300 hover:bg-ink-700",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs">
        {intel?.metrics?.horizons?.[0] && (
          <span className="chip border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            +{intel.metrics.horizons[0].improvement_pct.toFixed(0)}% vs persistence
          </span>
        )}
        {intel && (
          <span className="chip border border-ink-600 bg-ink-800 text-slate-300">
            {intel.data_source === "snapshot" ? "offline snapshot" : intel.data_source} · {intel.attributions.length} zones
          </span>
        )}
      </div>
    </header>
  );
}
