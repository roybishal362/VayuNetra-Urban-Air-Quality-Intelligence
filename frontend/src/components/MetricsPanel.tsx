"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { CityIntelligence } from "@/lib/types";
import { featureLabel } from "@/lib/sources";

const TIP = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 };

export default function MetricsPanel({ intel }: { intel: CityIntelligence }) {
  const m = intel.metrics;
  const head = m?.horizons?.[0];
  const importance = Object.entries(m?.feature_importance ?? {}).slice(0, 8);
  const maxImp = importance.length ? Math.max(...importance.map(([, v]) => v)) : 1;
  const backtest = (m?.backtest ?? []).map((p, i) => ({ i, actual: p.actual, predicted: p.predicted }));
  const scatter = m?.scatter ?? [];
  const scMax = scatter.length
    ? Math.ceil(Math.max(...scatter.map((s) => Math.max(s.actual, s.predicted))) / 10) * 10
    : 100;

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Forecast skill</div>
          {head && (
            <div className="text-right">
              <span className="font-mono text-2xl font-bold text-emerald-400">+{head.improvement_pct.toFixed(0)}%</span>
              <span className="ml-1 text-xs text-slate-400">RMSE vs persistence</span>
            </div>
          )}
        </div>
        {m && (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="text-left">
                <th className="py-1 font-medium">Lead</th>
                <th className="py-1 text-right font-medium">RMSE</th>
                <th className="py-1 text-right font-medium">Persist.</th>
                <th className="py-1 text-right font-medium">Gain</th>
                <th className="py-1 text-right font-medium">Corr</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-200">
              {m.horizons.map((h) => (
                <tr key={h.horizon_h} className="border-t border-ink-700">
                  <td className="py-1">+{h.horizon_h}h</td>
                  <td className="py-1 text-right">{h.rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-slate-400">{h.persistence_rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-emerald-400">+{h.improvement_pct.toFixed(0)}%</td>
                  <td className="py-1 text-right">{h.corr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {m && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="chip bg-ink-700 text-slate-300">held-out {m.n_test.toLocaleString()} samples</span>
            <span className="chip bg-ink-700 text-slate-300">band coverage {Math.round(m.coverage * 100)}% (target 80)</span>
            <span className="chip bg-ink-700 text-slate-300">
              ML weight {Math.round(m.blend_weight * 100)}%{m.blend_weight < 0.5 ? " · defers to baseline" : ""}
            </span>
          </div>
        )}
      </div>

      {backtest.length > 0 && (
        <div className="card p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Backtest · predicted vs actual (+24h)
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer>
              <LineChart data={backtest} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={false} stroke="#334155" height={4} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={34} />
                <Tooltip contentStyle={TIP} />
                <Line dataKey="actual" stroke="#94a3b8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line dataKey="predicted" stroke="#38bdf8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 text-[11px] text-slate-400">
            <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#94a3b8" }} /> actual</span>
            <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#38bdf8" }} /> predicted</span>
          </div>
        </div>
      )}

      {scatter.length > 0 && (
        <div className="card p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Predicted vs actual</div>
            {head && <span className="font-mono text-xs text-slate-300">r {head.corr.toFixed(2)}</span>}
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis type="number" dataKey="actual" domain={[0, scMax]} tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" name="actual" />
                <YAxis type="number" dataKey="predicted" domain={[0, scMax]} tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={34} name="predicted" />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: scMax, y: scMax }]} stroke="#475569" strokeDasharray="4 4" />
                <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatter} fill="#38bdf8" fillOpacity={0.45} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500">Points on the dashed diagonal = perfect prediction (µg/m³ PM2.5).</div>
        </div>
      )}

      {importance.length > 0 && (
        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">What drives the forecast</div>
          <div className="space-y-1.5">
            {importance.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-36 flex-shrink-0 truncate text-xs text-slate-300">{featureLabel(k)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(v / maxImp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Permutation importance — boundary-layer height + diurnal cycle dominate (physically consistent).
          </div>
        </div>
      )}
    </div>
  );
}
