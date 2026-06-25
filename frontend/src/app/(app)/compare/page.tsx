"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCity } from "@/lib/cityStore";
import type { CityComparison } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import { compact, skillLabel } from "@/lib/format";
import ComplianceLedger from "@/components/ComplianceLedger";
import StateMsg from "@/components/StateMsg";

export default function ComparePage() {
  const { setCityId } = useCity();
  const router = useRouter();
  const [data, setData] = useState<CityComparison[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.compare().then(setData).catch((e) => { setErr(String(e)); setData([]); }); }, []);

  if (err && (!data || !data.length)) return <StateMsg kind="error" title="Couldn’t load national comparison" detail={err} />;
  if (!data) return <StateMsg title="Loading national comparison…" />;
  const maxAqi = Math.max(...data.map((c) => c.avg_aqi), 1);
  const totalExposed = data.reduce((s, c) => s + c.exposed, 0);

  const open = (id: string) => { setCityId(id); router.push("/console"); };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">National air-quality comparison</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data.length} cities · {compact(totalExposed)} residents in Poor-or-worse air · ranked by current AQI
          </p>
        </header>

        <div className="space-y-2">
          {data.map((c, i) => (
            <button
              key={c.city_id}
              onClick={() => open(c.city_id)}
              className="card flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-brand/40"
            >
              <span className="w-6 font-display text-lg font-bold text-slate-500">{i + 1}</span>
              <div className="w-28 flex-shrink-0">
                <div className="font-semibold text-slate-100">{c.city_name}</div>
                <div className="text-xs" style={{ color: aqiColor(c.avg_aqi) }}>{c.category}</div>
              </div>
              <div className="h-6 flex-1 overflow-hidden rounded bg-ink-700">
                <div className="h-full rounded" style={{ width: `${(c.avg_aqi / maxAqi) * 100}%`, background: aqiColor(c.avg_aqi) }} />
              </div>
              <div className="w-14 text-right font-mono text-lg font-bold" style={{ color: aqiColor(c.avg_aqi) }}>{c.avg_aqi}</div>
              <div className="hidden w-24 text-right sm:block">
                <div className="font-mono text-sm text-text-mid">{compact(c.exposed)}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">exposed</div>
              </div>
              <div className="hidden w-20 text-right md:block">
                <div className="font-mono text-sm text-text-hi">{skillLabel(c.improvement_pct)}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">skill</div>
              </div>
              <div className="hidden w-16 text-right md:block">
                <div className="font-mono text-sm" style={{ color: c.alerts ? "#E93F33" : "#94a3b8" }}>{c.alerts}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">alerts</div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          One pipeline and model architecture across every city — adding a metro is a single config entry.
          Click any city to open its Command Center.
        </p>

        <ComplianceLedger />
      </div>
    </div>
  );
}
