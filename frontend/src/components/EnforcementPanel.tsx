"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { City, EnforcementItem, EnforcementRoi } from "@/lib/types";
import { trendArrow } from "@/lib/aqi";
import { sourceColor } from "@/lib/sources";

function RoiPlanner({ city }: { city: City }) {
  const [n, setN] = useState(3);
  const [roi, setRoi] = useState<EnforcementRoi | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.enforcementRoi(city.id, n).then((d) => !cancelled && setRoi(d)).catch(() => {});
    return () => { cancelled = true; };
  }, [city.id, n]);

  return (
    <div className="card p-3">
      <div className="eyebrow mb-1">Deploy for maximum impact</div>
      <div className="flex items-center gap-3">
        <input type="range" min={1} max={Math.min(12, roi?.total_wards ?? 12)} value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="flex-1 accent-[#55A84F]" aria-label="number of inspectors" />
        <span className="w-24 text-right font-mono text-xs text-text-mid">{n} inspector{n > 1 ? "s" : ""}</span>
      </div>
      {roi && (
        <div className="mt-2 flex items-end gap-2">
          <span className="font-display text-3xl font-semibold tabular-nums text-[#55A84F]">{roi.covered_pct}%</span>
          <span className="pb-1 text-[11px] leading-tight text-text-mid">
            of the city&apos;s pollution burden covered<br />
            ≈ {roi.population_covered.toLocaleString()} people protected
          </span>
        </div>
      )}
      {roi && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {roi.selected.map((s) => (
            <span key={s.zone_id} className="chip border border-white/[0.08] bg-vn-800/60 text-[10px] text-text">
              {s.zone_name} · {s.burden_share}%
            </span>
          ))}
        </div>
      )}
      <div className="mt-1 font-mono text-[9px] text-text-low">burden = people × severity × source-actionability</div>
    </div>
  );
}

function trendColor(t: string) {
  return t === "rising" ? "#E93F33" : t === "falling" ? "#55A84F" : "#94a3b8";
}

function Card({ city, item, onSelect }: { city: City; item: EnforcementItem; onSelect: () => void }) {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const color = sourceColor(item.dominant_source);

  const loadBrief = async () => {
    setLoading(true);
    try {
      const r = await api.enforcementBrief(city.id, item.zone_id);
      setBrief(r.brief);
    } catch (e) {
      setBrief(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-3">
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-ink-700 font-mono text-sm font-bold text-brand">
          {item.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-slate-100">{item.zone_name}</span>
            <span className="font-mono text-xs text-slate-400">pri {item.priority.toFixed(0)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="chip" style={{ background: `${color}22`, color }}>{item.dominant_label}</span>
            <span className="text-slate-400">
              AQI {item.current_aqi} <span style={{ color: trendColor(item.trend) }}>{trendArrow(item.trend)} {item.forecast_aqi_24h}</span>
            </span>
          </div>
        </div>
      </button>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full" style={{ width: `${item.priority}%`, background: color }} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.recommended_action}</p>
      <div className="mt-1 text-[11px] text-slate-500">
        ~{item.population_exposed.toLocaleString()} residents · {item.vulnerable_sites} schools/hospitals · conf {Math.round(item.confidence * 100)}%
      </div>

      {item.matched_sources && item.matched_sources.length > 0 && (
        <div className="mt-2 rounded-lg border border-white/[0.06] bg-vn-850/50 p-2">
          <div className="eyebrow mb-1">Registered emitters nearby</div>
          <ul className="space-y-1">
            {item.matched_sources.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.upwind ? "bg-[#E93F33]" : "bg-white/25"}`} />
                <span className="truncate text-text">{s.name}</span>
                <span className="ml-auto flex-shrink-0 font-mono text-text-low">{s.distance_km}km {s.bearing}</span>
                {s.upwind && <span className="flex-shrink-0 rounded bg-[#E93F33]/15 px-1 font-mono text-[9px] font-semibold text-[#E93F33]">UPWIND</span>}
              </li>
            ))}
          </ul>
          <div className="mt-1 font-mono text-[9px] text-text-low">WRI power-plant registry · upwind = plume reaches this ward now</div>
        </div>
      )}

      {brief ? (
        <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850/60 p-2 text-xs leading-relaxed text-slate-200">{brief}</p>
      ) : (
        <button
          onClick={loadBrief}
          disabled={loading}
          className="mt-2 text-xs font-medium text-brand hover:underline disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate inspection brief →"}
        </button>
      )}
    </div>
  );
}

export default function EnforcementPanel({
  city, items, onSelectZone,
}: {
  city: City;
  items: EnforcementItem[];
  onSelectZone: (id: string) => void;
}) {
  if (!items.length) return <div className="p-4 text-sm text-slate-500">No enforcement priorities.</div>;
  return (
    <div className="space-y-2">
      <RoiPlanner city={city} />
      <div className="px-1 text-xs text-slate-400">
        Ranked by severity, forecast trend, source actionability and population exposure.
      </div>
      {items.map((it) => (
        <Card key={it.zone_id} city={city} item={it} onSelect={() => onSelectZone(it.zone_id)} />
      ))}
    </div>
  );
}
