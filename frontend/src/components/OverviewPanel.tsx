"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { CityComparison, CityIntelligence } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import { compact } from "@/lib/format";

const ALERT_COLOR: Record<string, string> = { severe: "#E93F33", warning: "#F29C33", watch: "#FFF833" };

function Stat({ v, l, c }: { v: string; l: string; c?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850/50 py-2">
      <div className="text-lg font-bold" style={c ? { color: c } : undefined}>{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{l}</div>
    </div>
  );
}

export default function OverviewPanel({
  intel, onSelectZone, onCity, activeCityId,
}: {
  intel: CityIntelligence;
  onSelectZone: (id: string) => void;
  onCity: (id: string) => void;
  activeCityId: string;
}) {
  const [brief, setBrief] = useState<{ generated_by: string; briefing: string } | null>(null);
  const [compare, setCompare] = useState<CityComparison[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBrief(null);
    api.briefing(intel.city_id).then((b) => !cancelled && setBrief(b)).catch(() => {});
    return () => { cancelled = true; };
  }, [intel.city_id]);

  useEffect(() => {
    let cancelled = false;
    api.compare().then((d) => !cancelled && setCompare(d)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const h = intel.health;
  const maxAqi = compare && compare.length ? Math.max(...compare.map((c) => c.avg_aqi), 1) : 1;

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          National snapshot · {compare?.length ?? 0} cities
        </div>
        <div className="space-y-0.5">
          {(compare ?? []).map((c) => (
            <button
              key={c.city_id}
              onClick={() => onCity(c.city_id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors",
                c.city_id === activeCityId ? "bg-ink-700" : "hover:bg-ink-800",
              )}
            >
              <span className="w-20 flex-shrink-0 truncate text-sm text-slate-200">{c.city_name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-ink-700">
                <div className="h-full rounded" style={{ width: `${(c.avg_aqi / maxAqi) * 100}%`, background: aqiColor(c.avg_aqi) }} />
              </div>
              <span className="w-8 text-right font-mono text-xs" style={{ color: aqiColor(c.avg_aqi) }}>{c.avg_aqi}</span>
              <span className="w-10 text-right text-[11px] text-emerald-400">+{c.improvement_pct.toFixed(0)}%</span>
            </button>
          ))}
          {!compare && <div className="px-2 text-xs text-slate-500">Loading national snapshot…</div>}
        </div>
      </div>

      <div className="card p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Situation briefing</div>
          {brief && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {brief.generated_by === "template" ? "rule-based" : `AI · ${brief.generated_by}`}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-slate-200">
          {brief ? brief.briefing : "Generating briefing…"}
        </p>
      </div>

      {h && (
        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Health impact</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat v={compact(h.exposed_population)} l="exposed" c="#F29C33" />
            <Stat v={compact(h.severe_population)} l="in severe" c="#E93F33" />
            <Stat v={String(h.vulnerable_sites_affected)} l="schools/hosp" />
          </div>
          <div className="mt-2 text-xs text-slate-400">{h.note}</div>
        </div>
      )}

      <div className="card p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Alerts ({intel.alerts.length})
        </div>
        <div className="space-y-1.5">
          {intel.alerts.slice(0, 8).map((a, i) => (
            <button
              key={i}
              onClick={() => onSelectZone(a.zone_id)}
              className="flex w-full items-start gap-2 rounded-lg border border-ink-700 bg-ink-850/50 p-2 text-left hover:border-ink-600"
            >
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: ALERT_COLOR[a.level] ?? "#94a3b8" }} />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-200">{a.zone_name}</span>
                <span className="block text-xs text-slate-400">{a.message}</span>
              </span>
            </button>
          ))}
          {intel.alerts.length === 0 && <div className="text-xs text-slate-500">No active alerts.</div>}
        </div>
      </div>
    </div>
  );
}
