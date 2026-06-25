"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LockdownCheck } from "@/lib/types";

export default function LockdownCard({ cityId }: { cityId: string }) {
  const [d, setD] = useState<LockdownCheck | null>(null);
  useEffect(() => {
    let c = false;
    setD(null);
    api.lockdownCheck(cityId).then((x) => !c && setD(x)).catch(() => {});
    return () => { c = true; };
  }, [cityId]);
  if (!d) return null;
  const ok = d.verdict === "in range";

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="eyebrow">What-if validated vs a real event</div>
        <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold"
          style={{ background: ok ? "#55A84F22" : "#F29C3322", color: ok ? "#55A84F" : "#F29C33" }}>
          {ok ? "IN RANGE ✓" : "OFF"}
        </span>
      </div>
      <p className="mb-2 text-[12px] text-text-mid">{d.scenario}</p>
      <div className="flex items-end gap-6">
        <div>
          <div className="font-display text-3xl font-semibold tabular-nums text-text-hi">{d.predicted_drop_pct}%</div>
          <div className="font-mono text-[10px] text-text-low">our what-if predicts</div>
        </div>
        <div className="pb-1 text-text-low">vs</div>
        <div>
          <div className="font-display text-3xl font-semibold tabular-nums text-[#55A84F]">{d.measured_drop_pct}%</div>
          <div className="font-mono text-[10px] text-text-low">really measured</div>
        </div>
      </div>
      <p className="mt-2 font-mono text-[9px] leading-relaxed text-text-low">{d.source}</p>
    </div>
  );
}
