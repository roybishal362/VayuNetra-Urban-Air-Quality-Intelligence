"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CityCompliance, Intervention } from "@/lib/types";

const VERDICT: Record<string, { color: string; label: string }> = {
  worked: { color: "#55A84F", label: "WORKED" },
  mixed: { color: "#FFF833", label: "MIXED" },
  weak: { color: "#F29C33", label: "WEAK" },
};

export default function ComplianceLedger() {
  const [comp, setComp] = useState<CityCompliance[] | null>(null);
  const [iv, setIv] = useState<Intervention[] | null>(null);

  useEffect(() => {
    let c = false;
    api.compliance().then((d) => !c && setComp(d)).catch(() => {});
    api.interventions().then((d) => !c && setIv(d)).catch(() => {});
    return () => { c = true; };
  }, []);

  return (
    <div className="space-y-6">
      {/* compliance scorecard */}
      <div className="card p-4">
        <div className="eyebrow mb-1">Compliance scorecard</div>
        <p className="mb-3 text-[11px] text-text-low">
          Live PM2.5 vs the CPCB national standard (NAAQS, 60 µg/m³) and the WHO guideline (15 µg/m³).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(comp ?? []).map((c) => (
            <div key={c.city_id} className="rounded-lg border border-white/[0.06] bg-vn-850/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">{c.city_name}</span>
                <span className="grid h-6 w-6 place-items-center rounded-md font-display text-sm font-bold"
                  style={{ background: `${c.grade_color}22`, color: c.grade_color }}>{c.grade}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-text-mid">PM2.5 {c.avg_pm25}</div>
              <div className="font-mono text-[10px] text-text-low">{c.naaqs_exceedance}× NAAQS · {c.who_exceedance}× WHO</div>
            </div>
          ))}
          {!comp && <div className="text-xs text-text-low">Loading…</div>}
        </div>
      </div>

      {/* honest intervention ledger */}
      <div className="card p-4">
        <div className="eyebrow mb-1">What actually worked — intervention ledger</div>
        <p className="mb-3 text-[11px] text-text-low">
          Real policies and their measured/estimated effect on PM2.5 — honest about the ones that barely moved the needle.
        </p>
        <div className="space-y-2">
          {(iv ?? []).map((i, k) => {
            const v = VERDICT[i.verdict] ?? { color: "#94a3b8", label: i.verdict.toUpperCase() };
            return (
              <div key={k} className="flex items-start gap-3 border-b border-white/[0.04] pb-2 last:border-0">
                <span className="mt-0.5 w-16 flex-shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold"
                  style={{ background: `${v.color}1f`, color: v.color }}>{v.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm text-text">{i.policy}</span>
                  <span className="ml-2 font-mono text-xs" style={{ color: i.effect_pct <= -15 ? "#55A84F" : "#F29C33" }}>
                    {i.effect_pct}% PM2.5
                  </span>
                  <span className="block text-[11px] text-text-low">{i.note} <span className="text-text-low/70">· {i.source}</span></span>
                </span>
              </div>
            );
          })}
          {!iv && <div className="text-xs text-text-low">Loading…</div>}
        </div>
      </div>
    </div>
  );
}
