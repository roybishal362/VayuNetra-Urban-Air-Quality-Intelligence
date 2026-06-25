"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { useCity } from "@/lib/cityStore";
import { aqiColor } from "@/lib/aqi";
import { compact, fmtTime } from "@/lib/format";
import { cigarettesPerDay, shortTermMortalityRiskPct } from "@/lib/health";
import StateMsg from "@/components/StateMsg";

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (d: number) => COMPASS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];

export default function BriefPage() {
  const { city, intel, error } = useCity();

  const sources = useMemo(() => {
    if (!intel) return [];
    const agg: Record<string, { label: string; color: string; sum: number }> = {};
    for (const a of intel.attributions) for (const c of a.contributions) {
      agg[c.source] = agg[c.source] ?? { label: c.label, color: c.color, sum: 0 };
      agg[c.source].sum += c.pct;
    }
    const tot = Object.values(agg).reduce((s, x) => s + x.sum, 0) || 1;
    return Object.values(agg).map((x) => ({ ...x, pct: (x.sum / tot) * 100 })).sort((a, b) => b.pct - a.pct);
  }, [intel]);

  const wind = useMemo(() => {
    const a = (intel?.attributions ?? []).filter((x) => x.wind_dir != null);
    if (!a.length) return null;
    const speed = a.reduce((s, x) => s + (x.wind_speed ?? 0), 0) / a.length;
    let sx = 0, sy = 0;
    for (const x of a) { const r = ((x.wind_dir as number) * Math.PI) / 180; sx += Math.cos(r); sy += Math.sin(r); }
    return { dir: (((Math.atan2(sy, sx) * 180) / Math.PI) + 360) % 360, speed };
  }, [intel]);

  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load brief" detail={error} />;
  if (!city || !intel) return <StateMsg title="Preparing brief…" />;

  const h = intel.health;
  const rows = [...intel.attributions].sort((a, b) => b.aqi - a.aqi);
  const cityPm25 = rows.length ? rows.reduce((s, r) => s + r.pm25, 0) / rows.length : 0;
  const firesUpwind = Math.max(0, ...rows.map((r) => r.fires_upwind || 0));
  const top = sources[0];

  const why = (() => {
    const parts: string[] = [];
    parts.push(`${city.name}'s air is averaging AQI ${h?.avg_aqi ?? 0}${h?.worst_category ? ` (${h.worst_category.toLowerCase()})` : ""}, with ${rows[0]?.zone_name} the worst at ${rows[0]?.aqi ?? 0}.`);
    if (top) parts.push(`The biggest contributor right now is ${top.label.toLowerCase()} (~${top.pct.toFixed(0)}% of fine particulate).`);
    if (wind && wind.speed < 2) parts.push(`Winds are near-calm (${(wind.speed * 3.6).toFixed(0)} km/h from ${compass(wind.dir)}), so emissions are accumulating locally instead of dispersing.`);
    else if (wind) parts.push(`A ${(wind.speed * 3.6).toFixed(0)} km/h wind from ${compass(wind.dir)} is carrying pollution toward the ${compass((wind.dir + 180) % 360)}.`);
    if (firesUpwind > 0) parts.push(`${firesUpwind} active fire${firesUpwind > 1 ? "s" : ""} sit upwind, adding biomass smoke.`);
    parts.push(`Expect the worst readings overnight and early morning, when the boundary layer collapses and traps pollution near the ground; conditions usually ease by afternoon.`);
    return parts.join(" ");
  })();

  return (
    <div className="brief-page h-full overflow-y-auto bg-vn-base p-6 print:h-auto print:overflow-visible">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* action bar (not printed) */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/console" className="inline-flex items-center gap-1.5 text-sm text-text-mid hover:text-text-hi"><ArrowLeft size={15} /> Console</Link>
          <button onClick={() => window.print()} className="btn"><Printer size={15} /> Print / Save as PDF</button>
        </div>

        <header className="border-b border-white/[0.08] pb-4">
          <div className="eyebrow">VayuNetra · air-quality situation brief</div>
          <h1 className="mt-1 font-display text-3xl font-bold text-text-hi">{city.name}, {city.state}</h1>
          <p className="mt-1 font-mono text-[12px] text-text-low">As of {fmtTime(intel.now_ts)} · data: {intel.data_source} · CPCB AQI</p>
        </header>

        {/* headline numbers */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "City AQI", v: h?.avg_aqi ?? "—", c: h ? aqiColor(h.avg_aqi) : undefined, s: h?.worst_category },
            { l: "People in harmful air", v: h ? compact(h.exposed_population) : "—", s: "Poor or worse" },
            { l: "≈ Cigarettes/day", v: cigarettesPerDay(cityPm25).toFixed(1), s: "per resident" },
            { l: "Excess mortality risk", v: `+${shortTermMortalityRiskPct(cityPm25).toFixed(1)}%`, s: "short-term" },
          ].map((k) => (
            <div key={k.l} className="card p-3">
              <div className="eyebrow">{k.l}</div>
              <div className="font-display text-2xl font-semibold tabular-nums" style={k.c ? { color: k.c } : undefined}>{k.v}</div>
              {k.s && <div className="font-mono text-[11px] text-text-low">{k.s}</div>}
            </div>
          ))}
        </div>

        {/* why */}
        <div className="card p-4">
          <div className="eyebrow mb-2">Why the air is bad today</div>
          <p className="text-[15px] leading-relaxed text-text">{why}</p>
        </div>

        {/* sources */}
        <div className="card p-4">
          <div className="eyebrow mb-2">What’s causing it — city source mix</div>
          <div className="mb-2 flex h-3 w-full overflow-hidden rounded">
            {sources.map((s) => <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />)}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {sources.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /><span className="text-text">{s.label.split(" / ")[0]}</span></span>
                <span className="font-mono text-text-mid">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="card p-4">
          <div className="eyebrow mb-2">Recommended actions — act first</div>
          <ol className="space-y-2">
            {intel.enforcement.slice(0, 3).map((e, i) => (
              <li key={e.zone_id} className="flex gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-white/[0.08] font-mono text-[11px] font-bold text-text-hi">{i + 1}</span>
                <span><span className="font-semibold text-text-hi">{e.zone_name}</span> <span className="text-text-low">· {e.dominant_label}</span><br /><span className="text-text">{e.recommended_action}</span></span>
              </li>
            ))}
          </ol>
        </div>

        {/* worst wards */}
        <div className="card p-4">
          <div className="eyebrow mb-2">Worst wards</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {rows.slice(0, 9).map((r) => (
              <div key={r.zone_id} className="flex items-center justify-between">
                <span className="truncate text-text">{r.zone_name}</span>
                <span className="font-mono tabular-nums" style={{ color: aqiColor(r.aqi) }}>{r.aqi}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="pb-6 font-mono text-[11px] text-text-low">
          VayuNetra · वायु नेत्र · Monitor → Predict → Attribute → Act · cigarette equivalence (Berkeley Earth) and mortality (WHO/GBD) are illustrative estimates.
        </p>
      </div>
    </div>
  );
}
