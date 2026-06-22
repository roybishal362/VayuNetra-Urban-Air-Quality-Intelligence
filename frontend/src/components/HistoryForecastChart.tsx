"use client";

import {
  Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ForecastPoint, HistoryPoint } from "@/lib/types";

interface Row { t: number; obs?: number; fc?: number; lo?: number; hi?: number }

export default function HistoryForecastChart({
  history, forecast, nowTs,
}: {
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  nowTs: string;
}) {
  const now = new Date(nowTs).getTime();
  const map = new Map<number, Row>();
  for (const p of history) {
    const t = Math.round((new Date(p.ts).getTime() - now) / 3.6e6);
    map.set(t, { ...(map.get(t) ?? { t }), obs: p.pm25 });
  }
  for (const p of forecast) {
    map.set(p.horizon_h, { ...(map.get(p.horizon_h) ?? { t: p.horizon_h }), fc: p.pm25, lo: p.pm25_low ?? p.pm25, hi: p.pm25_high ?? p.pm25 });
  }
  // bridge observed -> forecast at t=0
  const lastObs = history.length ? history[history.length - 1].pm25 : null;
  if (lastObs != null) {
    const z = map.get(0) ?? { t: 0 };
    z.obs = z.obs ?? lastObs; z.fc = z.fc ?? lastObs; z.lo = z.lo ?? lastObs; z.hi = z.hi ?? lastObs;
    map.set(0, z);
  }
  const data = [...map.values()].sort((a, b) => a.t - b.t);
  if (!data.length) return <div className="grid h-52 place-items-center text-sm text-slate-500">No data</div>;

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <defs>
            <linearGradient id="fcband" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3"
            label={{ value: "now", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} ticks={[-48, -24, 0, 24, 48, 72]}
            tickFormatter={(v) => (v === 0 ? "now" : v > 0 ? `+${v}h` : `${v}h`)}
            tick={{ fill: "#64748b", fontSize: 11 }} stroke="#334155" />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#334155" width={40} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => (v === 0 ? "now" : Number(v) > 0 ? `+${v}h forecast` : `${-Number(v)}h ago`)}
            formatter={(val: number | string, name: string) => [
              typeof val === "number" ? `${val.toFixed(0)} µg/m³` : val,
              name === "obs" ? "observed" : name === "fc" ? "forecast" : name,
            ]} />
          <Area type="monotone" dataKey="hi" stroke="none" fill="url(#fcband)" isAnimationActive={false} connectNulls={false} />
          <Area type="monotone" dataKey="lo" stroke="none" fill="#0b1120" isAnimationActive={false} connectNulls={false} />
          <Line type="monotone" dataKey="obs" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          <Line type="monotone" dataKey="fc" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
