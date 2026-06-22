import type { CityIntelligence } from "@/lib/types";
import { featureLabel } from "@/lib/sources";

function fmt(ts: string) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MetricsPanel({ intel }: { intel: CityIntelligence }) {
  const m = intel.metrics;
  const head = m?.horizons?.[0];
  const importance = Object.entries(m?.feature_importance ?? {}).slice(0, 8);
  const maxImp = importance.length ? Math.max(...importance.map(([, v]) => v)) : 1;

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">City summary</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-200">{intel.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="chip bg-ink-700">data: {intel.data_source}</span>
          <span className="chip bg-ink-700">snapshot @ {fmt(intel.now_ts)}</span>
        </div>
      </div>

      {m && head && (
        <div className="card p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Forecast skill</div>
            <div className="text-right">
              <span className="font-mono text-2xl font-bold text-emerald-400">+{head.improvement_pct.toFixed(0)}%</span>
              <span className="ml-1 text-xs text-slate-400">vs persistence</span>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="text-left">
                <th className="py-1 font-medium">Lead</th>
                <th className="py-1 text-right font-medium">Model RMSE</th>
                <th className="py-1 text-right font-medium">Persistence</th>
                <th className="py-1 text-right font-medium">Gain</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-200">
              {m.horizons.map((h) => (
                <tr key={h.horizon_h} className="border-t border-ink-700">
                  <td className="py-1">+{h.horizon_h}h</td>
                  <td className="py-1 text-right">{h.rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-slate-400">{h.persistence_rmse.toFixed(1)}</td>
                  <td className="py-1 text-right text-emerald-400">+{h.improvement_pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[11px] text-slate-500">
            Held-out test: {m.n_test.toLocaleString()} samples · trained on {m.n_train.toLocaleString()} · target PM2.5 (µg/m³)
          </div>
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
            Permutation importance. Boundary-layer height + diurnal cycle dominate — physically consistent.
          </div>
        </div>
      )}
    </div>
  );
}
