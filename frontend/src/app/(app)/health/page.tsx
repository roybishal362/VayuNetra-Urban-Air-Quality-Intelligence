"use client";

import { useMemo, useState } from "react";
import { useCity } from "@/lib/cityStore";
import { aqiColor } from "@/lib/aqi";
import { compact } from "@/lib/format";
import { cigarettesPerDay, shortTermMortalityRiskPct, personalAdvice, GROUPS } from "@/lib/health";
import StateMsg from "@/components/StateMsg";

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="card flex flex-col justify-center px-4 py-3">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums leading-none" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="mt-1 font-mono text-[11px] text-text-low">{sub}</span>}
    </div>
  );
}

export default function HealthPage() {
  const { city, intel, error } = useCity();
  const [groupId, setGroupId] = useState("healthy");
  const [zoneId, setZoneId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!intel || !city) return [];
    const pop = new Map(city.zones.map((z) => [z.id, z.population ?? 0]));
    const vuln = new Map(city.zones.map((z) => [z.id, z.vulnerable_sites ?? 0]));
    return [...intel.attributions]
      .map((a) => ({ id: a.zone_id, name: a.zone_name, aqi: a.aqi, pm25: a.pm25, pop: pop.get(a.zone_id) ?? 0, vuln: vuln.get(a.zone_id) ?? 0 }))
      .sort((x, y) => y.aqi - x.aqi);
  }, [intel, city]);

  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load health data" detail={error} />;
  if (!intel || !city) return <StateMsg title="Loading exposure & health…" />;

  const cityPm25 = rows.length ? rows.reduce((s, r) => s + r.pm25, 0) / rows.length : 0;
  const cigCity = cigarettesPerDay(cityPm25);
  const mortCity = shortTermMortalityRiskPct(cityPm25);
  const h = intel.health;
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const sel = (zoneId && rows.find((r) => r.id === zoneId)) || rows[0];
  const advice = sel ? personalAdvice(sel.aqi, group) : personalAdvice(0, GROUPS[0]);
  const vulnWards = rows.filter((r) => r.aqi > 200 && r.vuln > 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold text-text-hi">Exposure &amp; health — {city.name}</h1>
          <p className="mt-1 text-sm text-text-mid">
            What the current air is doing to people — translated into cigarettes, excess risk and who is most exposed.
          </p>
        </header>

        {/* headline toll */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="City avg AQI" value={h?.avg_aqi ?? "—"} sub={h?.worst_category} color={h ? aqiColor(h.avg_aqi) : undefined} />
          <Stat label="≈ Cigarettes / day" value={cigCity.toFixed(1)} sub="per resident (PM2.5)" color={cigCity >= 5 ? "#E93F33" : cigCity >= 2 ? "#F29C33" : "#55A84F"} />
          <Stat label="Excess mortality risk" value={`+${mortCity.toFixed(1)}%`} sub="short-term, vs WHO-safe air" color={mortCity >= 5 ? "#E93F33" : undefined} />
          <Stat label="In harmful air" value={h ? compact(h.exposed_population) : "—"} sub="Poor air or worse" />
        </div>

        {/* personal exposure */}
        <div className="card p-4">
          <div className="eyebrow mb-3">Your personal exposure</div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="mb-1.5 text-[11px] text-text-mid">Who are you?</div>
              <div className="flex flex-wrap gap-1.5">
                {GROUPS.map((g) => (
                  <button key={g.id} onClick={() => setGroupId(g.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${groupId === g.id ? "border-white/[0.16] bg-white/[0.08] text-text-hi" : "border-white/[0.06] text-text-mid hover:text-text-hi"}`}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[12px] leading-relaxed" style={{ color: advice.color }}>{advice.summary}</div>
              <div className="mt-3 text-[11px] text-text-mid">Area</div>
              <select value={sel?.id} onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-vn-700/60 px-2.5 py-1.5 text-sm text-text-hi outline-none focus:border-white/20">
                {rows.map((r) => <option key={r.id} value={r.id} className="bg-vn-800">{r.name} · AQI {r.aqi}</option>)}
              </select>
            </div>

            <div className="min-w-[260px] flex-1 rounded-xl border border-white/[0.06] bg-vn-850/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-mid">{sel?.name}</span>
                <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${advice.color}22`, color: advice.color, boxShadow: `inset 0 0 0 1px ${advice.color}55` }}>{advice.level}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums" style={{ color: aqiColor(sel?.aqi ?? 0) }}>{sel?.aqi ?? "—"}</span>
                <span className="font-mono text-xs text-text-low">AQI · ≈ {cigarettesPerDay(sel?.pm25 ?? 0).toFixed(1)} cigs/day for you</span>
              </div>
              <ul className="mt-2 space-y-1">
                {advice.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-text"><span style={{ color: advice.color }}>•</span><span>{a}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-low">
            Cigarette equivalence: Berkeley Earth (~22 µg/m³ PM2.5 ≈ 1 cigarette/day). Mortality: WHO/GBD short-term response (~0.65% per 10 µg/m³). Personal weighting is guidance, not a diagnosis.
          </div>
        </div>

        {/* vulnerable sites */}
        <div className="card p-4">
          <div className="eyebrow mb-2">Who is most exposed — schools &amp; hospitals in bad air</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums text-text-hi">{h?.vulnerable_sites_affected ?? 0}</span>
            <span className="text-sm text-text-mid">schools / hospitals in Poor-or-worse air, across {vulnWards.length} wards</span>
          </div>
          {vulnWards.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {vulnWards.slice(0, 10).map((r) => (
                <span key={r.id} className="chip border border-white/[0.08] bg-vn-800/60 text-text">
                  {r.name} · <span style={{ color: aqiColor(r.aqi) }}>{r.aqi}</span> · {r.vuln} sites
                </span>
              ))}
            </div>
          )}
        </div>

        {/* per-ward table */}
        <div className="card p-4">
          <div className="eyebrow mb-2">Ward-by-ward exposure</div>
          <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[440px] text-sm">
            <thead className="text-[10px] uppercase tracking-[0.08em] text-text-mid">
              <tr className="border-b border-white/[0.06] text-left">
                <th className="py-1.5 font-medium">Ward</th>
                <th className="py-1.5 text-right font-medium">AQI</th>
                <th className="py-1.5 text-right font-medium">≈ Cigs/day</th>
                <th className="py-1.5 text-right font-medium">People</th>
                <th className="py-1.5 text-right font-medium">Schools/hosp</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-text">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]">
                  <td className="py-1.5 font-sans">{r.name}</td>
                  <td className="py-1.5 text-right" style={{ color: aqiColor(r.aqi) }}>{r.aqi}</td>
                  <td className="py-1.5 text-right">{cigarettesPerDay(r.pm25).toFixed(1)}</td>
                  <td className="py-1.5 text-right text-text-mid">{compact(r.pop)}</td>
                  <td className="py-1.5 text-right text-text-mid">{r.vuln || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
