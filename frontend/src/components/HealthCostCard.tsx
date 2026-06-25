"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthCost } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";

export default function HealthCostCard({ cityId }: { cityId: string }) {
  const [d, setD] = useState<HealthCost | null>(null);

  useEffect(() => {
    let cancelled = false;
    setD(null);
    api.healthCost(cityId).then((r) => !cancelled && setD(r)).catch(() => {});
    return () => { cancelled = true; };
  }, [cityId]);

  if (!d) return <div className="card p-4 text-sm text-text-low">Loading health-cost index…</div>;
  const yr = d.total_cr_year >= 1000 ? `₹${(d.total_cr_year / 1000).toFixed(1)}k cr/yr` : `₹${d.total_cr_year} cr/yr`;

  return (
    <div className="card p-4">
      <div className="eyebrow mb-2">Air-health-cost index — what this pollution costs</div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="font-display text-3xl font-semibold tabular-nums text-[#E93F33]">₹{d.total_cr_day} cr</div>
          <div className="font-mono text-[11px] text-text-low">per day · {yr}</div>
        </div>
        <div>
          <div className="font-display text-2xl font-semibold tabular-nums text-text-hi">₹{d.per_capita_rs_day}</div>
          <div className="font-mono text-[11px] text-text-low">per person / day</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {d.rows.slice(0, 6).map((r) => (
          <div key={r.zone_id} className="flex items-center justify-between">
            <span className="truncate text-text">{r.zone_name}</span>
            <span className="font-mono tabular-nums" style={{ color: aqiColor(r.pm25 * 2) }}>₹{r.cost_cr_day} cr</span>
          </div>
        ))}
      </div>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-low">{d.methodology}</p>
    </div>
  );
}
