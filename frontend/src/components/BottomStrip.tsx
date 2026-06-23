"use client";

import clsx from "clsx";
import type { CityIntelligence } from "@/lib/types";
import { AQI_BANDS, aqiColor } from "@/lib/aqi";

function Spark({ values, color = "#C9CBD0" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-9 w-32" />;
  const w = 128, h = 36;
  const min = Math.min(...values), max = Math.max(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

function Seg({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-shrink-0 flex-col gap-1">
      <div className="eyebrow">{title}</div>
      <div>{children}</div>
    </div>
  );
}

export default function BottomStrip({
  intel, showIndustry, onToggleIndustry,
}: {
  intel: CityIntelligence;
  showIndustry: boolean;
  onToggleIndustry: () => void;
}) {
  const spark = (intel.metrics?.backtest ?? []).map((p) => p.actual);
  const skill = intel.metrics?.horizons ?? [];

  const agg: Record<string, { label: string; color: string; sum: number }> = {};
  for (const a of intel.attributions)
    for (const c of a.contributions) {
      agg[c.source] = agg[c.source] ?? { label: c.label, color: c.color, sum: 0 };
      agg[c.source].sum += c.pct;
    }
  const mix = Object.values(agg).sort((a, b) => b.sum - a.sum);
  const total = mix.reduce((s, x) => s + x.sum, 0) || 1;
  const worst = [...intel.attributions].sort((a, b) => b.aqi - a.aqi).slice(0, 3);

  return (
    <div className="flex h-[88px] flex-shrink-0 items-center gap-6 overflow-x-auto border-t border-white/[0.06] bg-vn-900/60 px-4 backdrop-blur-xl">
      <Seg title="AQI scale">
        <div className="flex overflow-hidden rounded">
          {AQI_BANDS.map((b) => <span key={b.label} className="h-2.5 w-7" style={{ background: b.color }} title={b.label} />)}
        </div>
        <div className="mt-1 flex justify-between text-[8px] text-text-low"><span>Good</span><span>Severe</span></div>
      </Seg>

      <Seg title="City PM2.5 · recent backtest">
        <Spark values={spark} />
      </Seg>

      <Seg title="Forecast skill vs persistence">
        <div className="flex items-end gap-2">
          <span className="font-display text-2xl font-semibold leading-none tabular-nums text-text-hi">
            +{skill[0]?.improvement_pct.toFixed(0) ?? 0}%
          </span>
          <div className="flex gap-1">
            {skill.map((s) => (
              <div key={s.horizon_h} className="text-center">
                <div className="relative h-9 w-3 rounded-sm bg-white/[0.08]">
                  <div className="absolute bottom-0 w-full rounded-sm bg-text-hi/80"
                       style={{ height: `${Math.min(100, Math.max(6, s.improvement_pct))}%` }} />
                </div>
                <div className="font-mono text-[8px] text-text-low">{s.horizon_h}h</div>
              </div>
            ))}
          </div>
        </div>
      </Seg>

      <Seg title="City source mix">
        <div className="flex h-3 w-44 overflow-hidden rounded">
          {mix.map((m) => <div key={m.label} style={{ width: `${(m.sum / total) * 100}%`, background: m.color }} />)}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-text-mid">
          {mix.slice(0, 3).map((m) => (
            <span key={m.label}><span style={{ color: m.color }}>●</span> {m.label.split(" / ")[0]} {((m.sum / total) * 100).toFixed(0)}%</span>
          ))}
        </div>
      </Seg>

      <Seg title="Worst wards">
        <div className="space-y-0.5">
          {worst.map((z) => (
            <div key={z.zone_id} className="flex items-center gap-2 text-xs">
              <span className="w-7 text-right font-mono tabular-nums" style={{ color: aqiColor(z.aqi) }}>{z.aqi}</span>
              <span className="w-24 truncate text-text">{z.zone_name}</span>
            </div>
          ))}
        </div>
      </Seg>

      <button
        onClick={onToggleIndustry}
        className={clsx(
          "ml-auto flex flex-shrink-0 items-center gap-1.5 self-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-fast",
          showIndustry
            ? "border-white/[0.14] bg-white/[0.08] text-text-hi"
            : "border-white/[0.06] text-text hover:border-white/[0.12] hover:bg-white/[0.04]",
        )}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "#E67E22" }} />
        Industry
      </button>
    </div>
  );
}
