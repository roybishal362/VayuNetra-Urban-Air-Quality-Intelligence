"use client";

import {
  Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ForecastPoint } from "@/lib/types";
import { aqiBand } from "@/lib/aqi";

interface Row { h: number; pm25: number; low: number; high: number; aqi: number; category: string }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const band = aqiBand(r.aqi);
  return (
    <div className="card px-3 py-2 text-xs">
      <div className="font-semibold text-slate-200">+{r.h}h forecast</div>
      <div className="mt-1 text-slate-300">PM2.5 {r.pm25.toFixed(0)} µg/m³ <span className="text-slate-500">({r.low.toFixed(0)}–{r.high.toFixed(0)})</span></div>
      <div className="mt-1 flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
        <span>AQI {r.aqi} · {r.category}</span>
      </div>
    </div>
  );
}

export default function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const data: Row[] = points.map((p) => ({
    h: p.horizon_h, pm25: p.pm25, low: p.pm25_low ?? p.pm25, high: p.pm25_high ?? p.pm25,
    aqi: p.aqi, category: p.category,
  }));
  if (!data.length) return <div className="h-48 grid place-items-center text-sm text-slate-500">No forecast</div>;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <defs>
            <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <ReferenceLine y={60} stroke="#334155" strokeDasharray="3 3" />
          <ReferenceLine y={120} stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="h" ticks={[0, 24, 48, 72]} tickFormatter={(v) => (v === 0 ? "now" : `+${v}h`)}
            tick={{ fill: "#64748b", fontSize: 11 }} stroke="#334155" />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#334155" width={40} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="high" stroke="none" fill="url(#band)" isAnimationActive={false} />
          <Area type="monotone" dataKey="low" stroke="none" fill="#0b1120" isAnimationActive={false} />
          <Line type="monotone" dataKey="pm25" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
