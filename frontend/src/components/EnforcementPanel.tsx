"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { City, EnforcementItem } from "@/lib/types";
import { trendArrow } from "@/lib/aqi";
import { sourceColor } from "@/lib/sources";

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
      <div className="flex cursor-pointer items-start gap-3" onClick={onSelect}>
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
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full" style={{ width: `${item.priority}%`, background: color }} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.recommended_action}</p>
      <div className="mt-1 text-[11px] text-slate-500">
        ~{item.population_exposed.toLocaleString()} residents · {item.vulnerable_sites} schools/hospitals · conf {Math.round(item.confidence * 100)}%
      </div>

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
      <div className="px-1 text-xs text-slate-400">
        Ranked by severity, forecast trend, source actionability and population exposure.
      </div>
      {items.map((it) => (
        <Card key={it.zone_id} city={city} item={it} onSelect={() => onSelectZone(it.zone_id)} />
      ))}
    </div>
  );
}
