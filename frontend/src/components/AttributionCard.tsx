import type { ZoneAttribution } from "@/lib/types";

export default function AttributionCard({ attr }: { attr: ZoneAttribution }) {
  const top = attr.contributions[0];
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400">Dominant source</div>
          <div className="text-lg font-semibold" style={{ color: top?.color }}>{attr.dominant_label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Confidence</div>
          <div className="font-mono text-lg text-slate-200">{Math.round(attr.overall_confidence * 100)}%</div>
        </div>
      </div>

      {/* stacked apportionment bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-md">
        {attr.contributions.map((c) => (
          <div key={c.source} style={{ width: `${c.pct}%`, background: c.color }} title={`${c.label} ${c.pct}%`} />
        ))}
      </div>

      <div className="space-y-1">
        {attr.contributions.map((c) => (
          <div key={c.source} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
              <span className="text-slate-300">{c.label}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
              <span>{c.concentration.toFixed(0)} µg/m³</span>
              <span className="w-10 text-right text-slate-200">{c.pct.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Evidence</div>
        <ul className="space-y-1">
          {attr.evidence.map((e, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-300">
              <span className="mt-0.5 font-medium text-brand">{e.signal}</span>
              <span className="text-slate-400">{e.detail}</span>
            </li>
          ))}
          {attr.evidence.length === 0 && <li className="text-xs text-slate-500">No dominant signal — mixed sources.</li>}
        </ul>
      </div>
    </div>
  );
}
