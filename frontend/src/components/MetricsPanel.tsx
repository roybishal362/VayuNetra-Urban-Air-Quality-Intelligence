"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { CityIntelligence } from "@/lib/types";
import { featureLabel } from "@/lib/sources";
import { skillLabel } from "@/lib/format";

const TIP = {
  background: "rgba(11,12,14,0.92)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12,
  color: "#C9CBD0",
};
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "rgba(255,255,255,0.1)";
const TICK = "#6B6D74";

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
          <div className="eyebrow">Forecast skill</div>
          {head && (
            <div className="text-right">
              <span className="font-mono text-2xl font-bold tabular-nums text-text-hi">{skillLabel(head.improvement_pct)}</span>
              <span className="ml-1 text-xs text-text-mid">RMSE vs persistence</span>
            </div>
          )}
        </div>
        {m && (
          <table className="w-full text-xs">
            <thead className="text-text-low">
              <tr className="text-left">
                <th className="py-1 font-medium">Lead</th>
                <th className="py-1 text-right font-medium">RMSE</th>
                <th className="py-1 text-right font-medium">Persist.</th>
                <th className="py-1 text-right font-medium">Gain</th>
                <th className="py-1 text-right font-medium">Corr</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-text">
              {m.horizons.map((h) => (
                <tr key={h.horizon_h} className="border-t border-white/[0.06]">
                  <td className="py-1">+{h.horizon_h}h</td>
                  <td className="py-1 text-right">{h.rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-text-mid">{h.persistence_rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-text-hi">{skillLabel(h.improvement_pct)}</td>
                  <td className="py-1 text-right">{h.corr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {m && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="chip bg-white/[0.06] text-text">held-out {m.n_test.toLocaleString()} samples</span>
            <span className="chip bg-white/[0.06] text-text">band coverage {Math.round(m.coverage * 100)}% (target 80)</span>
            <span className="chip bg-white/[0.06] text-text">
              ML weight {Math.round(m.blend_weight * 100)}%{m.blend_weight < 0.5 ? " · defers to baseline" : ""}
            </span>
          </div>
        )}
      </div>

      {backtest.length > 0 && (
        <div className="card p-3">
          <div className="eyebrow mb-1">Backtest · predicted vs actual (+24h)</div>
          <div className="h-40 w-full">
            <ResponsiveContainer>
              <LineChart data={backtest} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={false} stroke={AXIS} height={4} />
                <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} width={34} />
                <Tooltip contentStyle={TIP} />
                <Line dataKey="actual" stroke="#9A9CA3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line dataKey="predicted" stroke="#F4F5F6" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 text-[11px] text-text-mid">
            <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#9A9CA3" }} /> actual</span>
            <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#F4F5F6" }} /> predicted</span>
          </div>
        </div>
      )}

      {scatter.length > 0 && (
        <div className="card p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="eyebrow">Predicted vs actual</div>
            {head && <span className="font-mono text-xs text-text">r {head.corr.toFixed(2)}</span>}
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="actual" domain={[0, scMax]} tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} name="actual" />
                <YAxis type="number" dataKey="predicted" domain={[0, scMax]} tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} width={34} name="predicted" />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: scMax, y: scMax }]} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />
                <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: "3 3", stroke: AXIS }} />
                <Scatter data={scatter} fill="#F4F5F6" fillOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-text-low">Points on the dashed diagonal = perfect prediction (µg/m³ PM2.5).</div>
        </div>
      )}

      {importance.length > 0 && (
        <div className="card p-3">
          <div className="eyebrow mb-2">What drives the forecast</div>
          <div className="space-y-1.5">
            {importance.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-36 flex-shrink-0 truncate text-xs text-text">{featureLabel(k)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-text-hi/80" style={{ width: `${(v / maxImp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-text-low">
            Permutation importance — boundary-layer height + diurnal cycle dominate (physically consistent).
          </div>
        </div>
      )}
    </div>
  );
}
