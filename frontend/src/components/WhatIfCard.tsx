"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { City, SimulationResult, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn } from "@/lib/aqi";

function AqiBox({ aqi, label }: { aqi: number; label: string }) {
  const c = aqiColor(aqi);
  return (
    <div className="text-center">
      <div className="grid h-12 w-14 place-items-center rounded-lg font-mono text-xl font-bold" style={{ background: c, color: textOn(c) }}>
        {aqi}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

export default function WhatIfCard({ city, attribution }: { city: City; attribution: ZoneAttribution }) {
  const sources = attribution.contributions.slice(0, 4);
  const [source, setSource] = useState(attribution.dominant_source);
  const [reduction, setReduction] = useState(0.3);
  const [sim, setSim] = useState<SimulationResult | null>(null);

  useEffect(() => { setSource(attribution.dominant_source); }, [attribution.zone_id, attribution.dominant_source]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      api.simulate(city.id, attribution.zone_id, source, reduction)
        .then((s) => !cancelled && setSim(s)).catch(() => {});
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [city.id, attribution.zone_id, source, reduction]);

  const activeLabel = sources.find((s) => s.source === source)?.label ?? source;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {sources.map((s) => (
          <button
            key={s.source}
            onClick={() => setSource(s.source)}
            className={clsx("chip transition-colors", s.source === source ? "text-ink-950" : "")}
            style={s.source === source ? { background: s.color } : { background: `${s.color}22`, color: s.color }}
          >
            {s.label.split(" / ")[0]}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Reduce this source</span>
          <span className="font-mono text-slate-200">{Math.round(reduction * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={0.6} step={0.05} value={reduction}
          onChange={(e) => setReduction(parseFloat(e.target.value))}
          className="w-full accent-brand"
        />
      </div>

      {sim && (
        <div className="flex items-center justify-center gap-3">
          <AqiBox aqi={sim.original_aqi} label="now" />
          <span className="text-slate-500">→</span>
          <AqiBox aqi={sim.new_aqi} label="after" />
          <span className="font-mono text-sm font-semibold" style={{ color: sim.delta_aqi < 0 ? "#55A84F" : sim.delta_aqi > 0 ? "#E93F33" : "#9A9CA3" }}>
            {sim.delta_aqi <= 0 ? sim.delta_aqi : `+${sim.delta_aqi}`}
          </span>
        </div>
      )}

      <div className="text-[11px] text-slate-500">
        Estimated PM2.5-AQI if {activeLabel} is cut {Math.round(reduction * 100)}% in this ward.
      </div>
    </div>
  );
}
