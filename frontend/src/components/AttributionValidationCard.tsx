"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AttributionValidation } from "@/lib/types";

export default function AttributionValidationCard({ cityId }: { cityId: string }) {
  const [v, setV] = useState<AttributionValidation | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setV(null); setErr(false);
    api.attributionValidation(cityId)
      .then((d) => !cancelled && setV(d))
      .catch(() => !cancelled && setErr(true));
    return () => { cancelled = true; };
  }, [cityId]);

  if (err) return null;
  if (!v) return <div className="card p-4 text-sm text-text-low">Loading attribution validation…</div>;

  const score = v.agreement_pct;
  const scoreColor = score >= 85 ? "#55A84F" : score >= 75 ? "#A3C853" : "#F29C33";

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Source-attribution validation</div>
        {v.indicative && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-text-low">INDICATIVE REF</span>}
      </div>

      <div className="flex items-end gap-3">
        <span className="font-display text-4xl font-semibold tabular-nums" style={{ color: scoreColor }}>{score}%</span>
        <span className="pb-1 text-xs text-text-mid">
          agreement with published<br />receptor-model studies
        </span>
        <span className="ml-auto pb-1 text-right font-mono text-[11px] text-text-low">
          {v.within_range}/{v.n_sources} sources in range<br />mean dev {v.mean_abs_deviation_pp}pp
        </span>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead className="text-[10px] uppercase tracking-[0.08em] text-text-mid">
          <tr className="border-b border-white/[0.06] text-left">
            <th className="py-1.5 font-medium">Source</th>
            <th className="py-1.5 text-right font-medium">Ours</th>
            <th className="py-1.5 text-right font-medium">Published</th>
            <th className="py-1.5 text-center font-medium">In&nbsp;range</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {v.rows.map((r) => (
            <tr key={r.source} className="border-b border-white/[0.04]">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                  <span className="text-text">{r.label.split(" / ")[0]}</span>
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-text-hi">{r.ours}%</td>
              <td className="py-1.5 text-right font-mono text-text-mid">{r.reference}% <span className="text-text-low">[{r.low}–{r.high}]</span></td>
              <td className="py-1.5 text-center">{r.within ? <span className="text-[#55A84F]">✓</span> : <span className="text-text-low">✗</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-low">
        Honest check: our city-average split vs peer-reviewed / government receptor studies.
        Reference: {v.citation}. We report the real agreement — gaps (e.g. off-season biomass) shown openly.
      </p>
    </div>
  );
}
