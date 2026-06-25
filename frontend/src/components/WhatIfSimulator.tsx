"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { City, WhatIf } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import { sourceColor } from "@/lib/sources";

const SOURCES: { key: string; label: string }[] = [
  { key: "vehicular", label: "Vehicular" },
  { key: "industrial", label: "Industrial" },
  { key: "dust_construction", label: "Dust / Construction" },
  { key: "biomass_burning", label: "Biomass" },
  { key: "secondary", label: "Secondary" },
];

export default function WhatIfSimulator({ city }: { city: City }) {
  const [r, setR] = useState<Record<string, number>>({});
  const [res, setRes] = useState<WhatIf | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      api.whatif(city.id, { vehicular: 0, industrial: 0, dust_construction: 0, biomass_burning: 0, secondary: 0, ...r })
        .then((d) => !cancelled && setRes(d)).catch(() => {});
    }, 180);
    return () => { cancelled = true; clearTimeout(id); };
  }, [city.id, r]);

  const drop = res ? res.original_avg_aqi - res.new_avg_aqi : 0;

  return (
    <div className="card p-3">
      <div className="eyebrow mb-1">What-if: cut pollution at source</div>
      <p className="mb-2 text-[11px] text-text-low">Drag a source down and see the city&apos;s air respond.</p>

      <div className="space-y-2">
        {SOURCES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="flex w-28 flex-shrink-0 items-center gap-1.5 text-[11px] text-text">
              <span className="h-2 w-2 rounded-sm" style={{ background: sourceColor(s.key) }} />{s.label}
            </span>
            <input type="range" min={0} max={100} value={Math.round((r[s.key] ?? 0) * 100)}
              onChange={(e) => setR((p) => ({ ...p, [s.key]: Number(e.target.value) / 100 }))}
              className="flex-1 accent-[#55A84F]" aria-label={`reduce ${s.label}`} />
            <span className="w-9 text-right font-mono text-[11px] text-text-mid">{Math.round((r[s.key] ?? 0) * 100)}%</span>
          </div>
        ))}
      </div>

      {res && (
        <div className="mt-3 flex items-end gap-3 border-t border-white/[0.06] pt-2">
          <div>
            <div className="font-mono text-[10px] text-text-low">city AQI</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-semibold tabular-nums text-text-low line-through">{res.original_avg_aqi}</span>
              <span className="font-display text-3xl font-semibold tabular-nums" style={{ color: aqiColor(res.new_avg_aqi) }}>{res.new_avg_aqi}</span>
              {drop > 0 && <span className="font-mono text-sm text-[#55A84F]">−{drop}</span>}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-display text-2xl font-semibold tabular-nums text-[#55A84F]">{res.people_protected.toLocaleString()}</div>
            <div className="font-mono text-[10px] text-text-low">people out of harmful air</div>
          </div>
        </div>
      )}
    </div>
  );
}
