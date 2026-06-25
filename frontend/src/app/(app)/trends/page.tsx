"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, Cell, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useCity } from "@/lib/cityStore";
import type { HistoryPoint } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";
import StateMsg from "@/components/StateMsg";

const TIP = { background: "rgba(11,12,14,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, color: "#C9CBD0" };
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "rgba(255,255,255,0.1)";
const TICK = "#82858E";

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="card flex flex-col justify-center px-4 py-3">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums leading-none" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="mt-1 font-mono text-[11px] text-text-low">{sub}</span>}
    </div>
  );
}

export default function TrendsPage() {
  const { city, intel, error } = useCity();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [pts, setPts] = useState<HistoryPoint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const worst = useMemo(
    () => (intel?.attributions?.length ? [...intel.attributions].sort((a, b) => b.aqi - a.aqi)[0].zone_id : null),
    [intel],
  );
  const zid = zoneId ?? worst;

  useEffect(() => { setZoneId(null); setPts(null); }, [city?.id]);

  useEffect(() => {
    if (!city || !zid) return;
    let cancelled = false;
    setPts(null); setErr(null);
    api.zoneHistory(city.id, zid, 168).then((h) => !cancelled && setPts(h.points)).catch((e) => !cancelled && setErr(String(e)));
    return () => { cancelled = true; };
  }, [city?.id, zid]);

  const series = useMemo(() => (pts ?? []).map((p, i) => ({ i, aqi: p.aqi, ts: p.ts })), [pts]);
  const diurnal = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
    for (const p of pts ?? []) { const h = new Date(p.ts).getHours(); buckets[h].sum += p.aqi; buckets[h].n++; }
    return buckets.map((b, hour) => ({ hour, aqi: b.n ? Math.round(b.sum / b.n) : 0 }));
  }, [pts]);

  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load data" detail={error} />;
  if (!city || !intel) return <StateMsg title="Loading trends…" />;

  const zone = city.zones.find((z) => z.id === zid);
  const aqis = (pts ?? []).map((p) => p.aqi);
  const avg = aqis.length ? Math.round(aqis.reduce((s, v) => s + v, 0) / aqis.length) : 0;
  const peak = aqis.length ? Math.max(...aqis) : 0;
  const days = aqis.length ? Math.round(aqis.length / 24) : 0;
  const worstHour = diurnal.reduce((a, b) => (b.aqi > a.aqi ? b : a), diurnal[0] ?? { hour: 0, aqi: 0 });
  const bestHour = diurnal.filter((d) => d.aqi > 0).reduce((a, b) => (b.aqi < a.aqi ? b : a), { hour: 0, aqi: 9999 });
  const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-hi">Air-quality trends — {city.name}</h1>
            <p className="mt-1 text-sm text-text-mid">The last {days || 7} days and the daily rhythm of pollution for a ward.</p>
          </div>
          <select value={zid ?? ""} onChange={(e) => setZoneId(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-vn-700/60 px-3 py-2 text-sm text-text-hi outline-none focus:border-white/20">
            {[...intel.attributions].sort((a, b) => b.aqi - a.aqi).map((a) => (
              <option key={a.zone_id} value={a.zone_id} className="bg-vn-800">{a.zone_name} · AQI {a.aqi}</option>
            ))}
          </select>
        </header>

        {err && <StateMsg kind="error" title="Couldn’t load history" detail={err} className="h-40" />}
        {!err && !pts && <StateMsg title="Loading history…" className="h-40" />}

        {pts && pts.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={`${days}-day avg AQI`} value={avg} color={aqiColor(avg)} />
              <Stat label="Peak AQI" value={peak} color={aqiColor(peak)} />
              <Stat label="Worst hour" value={fmtHour(worstHour.hour)} sub={`avg ${worstHour.aqi}`} color={aqiColor(worstHour.aqi)} />
              <Stat label="Cleanest hour" value={fmtHour(bestHour.hour)} sub={`avg ${bestHour.aqi}`} color={aqiColor(bestHour.aqi)} />
            </div>

            <div className="card p-4">
              <div className="eyebrow mb-2">AQI over the last {days} days · {zone?.name}</div>
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F4F5F6" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#F4F5F6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} />
                    <ReferenceLine y={200} stroke="rgba(242,156,51,0.4)" strokeDasharray="3 3" label={{ value: "Poor", fill: "#82858E", fontSize: 10, position: "insideTopRight" }} />
                    <ReferenceLine y={400} stroke="rgba(233,63,51,0.4)" strokeDasharray="3 3" label={{ value: "Severe", fill: "#82858E", fontSize: 10, position: "insideTopRight" }} />
                    <XAxis dataKey="i" tickFormatter={(v) => `${Math.round((series.length - v) / 24)}d`} ticks={series.filter((_, i) => i % 24 === 0).map((d) => d.i)} tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} />
                    <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} width={36} />
                    <Tooltip contentStyle={TIP} formatter={(v: number | string) => [v, "AQI"]} labelFormatter={(v) => series[v as number] ? new Date(series[v as number].ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }) : ""} />
                    <Area type="monotone" dataKey="aqi" stroke="#F4F5F6" strokeWidth={1.6} fill="url(#trend)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <div className="eyebrow mb-1">Daily rhythm — average AQI by hour of day</div>
              <p className="mb-2 text-[12px] text-text-mid">Pollution peaks around <span className="text-text-hi">{fmtHour(worstHour.hour)}</span> and is cleanest near <span className="text-text-hi">{fmtHour(bestHour.hour)}</span> — driven by traffic + the boundary-layer collapsing overnight.</p>
              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={diurnal} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => (h % 6 === 0 ? fmtHour(h) : "")} tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} interval={0} />
                    <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={AXIS} width={36} />
                    <Tooltip contentStyle={TIP} formatter={(v: number | string) => [v, "avg AQI"]} labelFormatter={(h) => `${fmtHour(h as number)}`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="aqi" radius={[2, 2, 0, 0]}>
                      {diurnal.map((d) => <Cell key={d.hour} fill={aqiColor(d.aqi)} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {pts && pts.length === 0 && !err && <StateMsg kind="empty" title="No history available for this ward yet." className="h-40" />}
      </div>
    </div>
  );
}
