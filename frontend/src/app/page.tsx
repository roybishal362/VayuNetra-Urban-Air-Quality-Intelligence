"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity, TrendingUp, GitBranch, ShieldAlert, ArrowRight,
  Languages, FlaskConical, BarChart3, Github,
} from "lucide-react";
import { api } from "@/lib/api";
import type { City, CityComparison, GridCell, LatLon } from "@/lib/types";
import { aqiColor, textOn, AQI_BANDS } from "@/lib/aqi";
import { compact } from "@/lib/format";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";

const HeroMap = dynamic(() => import("@/components/HeroMap"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-text-low">Loading live skyline…</div>,
});

const DOTS = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)",
  backgroundSize: "22px 22px",
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass min-w-[116px] px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className="font-display text-2xl font-semibold tabular-nums leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate font-mono text-[11px] text-text-low">{sub}</div>}
    </div>
  );
}

export default function Landing() {
  const [cities, setCities] = useState<City[]>([]);
  const [compare, setCompare] = useState<CityComparison[]>([]);
  const [cells, setCells] = useState<GridCell[]>([]);
  const [hero, setHero] = useState<{ id: string; name: string; center: LatLon; step: number } | null>(null);

  useEffect(() => {
    let on = true;
    api.cities().then((cs) => {
      if (!on) return;
      setCities(cs);
      const h = cs.find((c) => c.id === "delhi") ?? cs[0];
      if (h) {
        setHero({ id: h.id, name: h.name, center: h.center, step: h.grid_step_km });
        api.grid(h.id, "current", 0).then((g) => on && setCells(g.cells)).catch(() => {});
      }
    }).catch(() => {});
    api.compare().then((d) => on && setCompare(d)).catch(() => {});
    return () => { on = false; };
  }, []);

  const heroCmp = useMemo(() => compare.find((c) => c.city_id === hero?.id), [compare, hero]);
  const citiesLive = cities.length || compare.length;
  const wards = useMemo(() => cities.reduce((s, c) => s + (c.zones?.length ?? 0), 0), [cities]);
  const skill = compare.length
    ? Math.round(compare.reduce((s, c) => s + c.improvement_pct, 0) / compare.length)
    : null;

  return (
    <div className="min-h-dvh bg-vn-base text-text">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-vn-base/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5 text-text-hi">
            <Logo size={36} accent />
            <span className="font-display text-[17px] font-semibold tracking-tight">VayuNetra</span>
            <span className="hidden font-mono text-[10px] text-text-low sm:inline">वायु · नेत्र</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {[
              { href: "/forecast", label: "Forecast" },
              { href: "/console", label: "Attribution" },
              { href: "/validation", label: "Validation" },
              { href: "/about", label: "About" },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-text-mid transition-colors hover:bg-white/[0.05] hover:text-text-hi">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/console" className="btn ml-2 md:ml-1">
            Open Console <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={DOTS} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-20">
          {/* copy */}
          <div className="relative">
            <Reveal>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-vn-800/60 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text-hi vn-breathe" />
                <span className="eyebrow">Urban air-quality intelligence · India</span>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-text-hi sm:text-5xl">
                See the air your<br />city breathes.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 font-display text-lg text-text-mid">Monitor → Predict → Attribute → Act.</p>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-text-mid">
                VayuNetra fuses sensor networks, satellite columns and land-use regression into one console —
                live hyperlocal AQI, 72-hour ML forecasts, source attribution and enforcement-ready advisories
                for every Indian ward.
              </p>
            </Reveal>
            <Reveal delay={230}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/console" className="btn px-4 py-2.5 text-[15px]">
                  Open the console <ArrowRight size={16} />
                </Link>
                <Link href="/compare" className="btn-ghost px-4 py-2.5 text-[15px]">National overview</Link>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p className="mt-7 font-mono text-[11px] leading-relaxed text-text-low">
                CPCB AQI bands · 72-hour horizon · land-use-regression downscaling · MapLibre · open data
              </p>
            </Reveal>
          </div>

          {/* live product */}
          <Reveal delay={220}>
            <div className="glass relative h-[420px] overflow-hidden rounded-2xl lg:h-[540px]">
              <div className="absolute inset-0">
                {cells.length > 0 && hero ? (
                  <HeroMap cells={cells} center={hero.center} stepKm={hero.step} />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm text-text-low">Loading live skyline…</div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-vn-base/80 to-transparent" />
              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-vn-base/60 px-2.5 py-1 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-text-hi vn-breathe" />
                <span className="font-mono text-[11px] text-text">{hero?.name ?? "—"} · CPCB AQI</span>
              </div>
              {/* floating live stats */}
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
                {heroCmp && (
                  <>
                    <StatCard label="City AQI" value={String(heroCmp.avg_aqi)} sub={heroCmp.category} color={aqiColor(heroCmp.avg_aqi)} />
                    <StatCard label="Worst ward" value={String(heroCmp.worst_aqi)} sub={heroCmp.worst_zone} color={aqiColor(heroCmp.worst_aqi)} />
                    <StatCard label="Exposed" value={compact(heroCmp.exposed)} sub="poor air or worse" />
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROOF STRIP ─────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-vn-900/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 lg:grid-cols-4">
          {[
            { label: "Cities live", value: citiesLive ? String(citiesLive) : "—" },
            { label: "Forecast horizon", value: "72h" },
            { label: "Skill vs persistence", value: skill != null ? `+${skill}%` : "—" },
            { label: "Wards monitored", value: wards ? String(wards) : "—" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 60} className="py-6 text-center">
              <div className="font-display text-3xl font-semibold tabular-nums text-text-hi">{s.value}</div>
              <div className="eyebrow mt-1">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PIPELINE ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-16">
        <Reveal className="mb-8 text-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-hi">One loop, four moves</h2>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Activity, t: "Monitor", d: "Sensor + satellite fusion, downscaled to ward resolution." },
            { icon: TrendingUp, t: "Predict", d: "72-hour PM2.5 forecast with calibrated uncertainty bands." },
            { icon: GitBranch, t: "Attribute", d: "Confidence-scored source split — traffic, industry, biomass, dust." },
            { icon: ShieldAlert, t: "Act", d: "Ranked enforcement queue + multilingual citizen advisories." },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 70}>
              <div className="card card-hover h-full p-4">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-vn-750/60 text-text-hi">
                  <p.icon size={18} strokeWidth={1.6} />
                </div>
                <div className="font-display text-base font-semibold text-text-hi">{p.t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-text-mid">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURE BENTO ──────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-16">
        <Reveal className="mb-8">
          <div className="eyebrow">The console</div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-hi">Everything a city needs to act on its air</h2>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* big feature */}
          <Reveal className="sm:col-span-2 lg:col-span-2">
            <Link href="/console" className="card card-hover group flex h-full flex-col justify-between overflow-hidden p-5">
              <div>
                <div className="mb-3 flex items-center gap-2 text-text-hi">
                  <Activity size={18} strokeWidth={1.6} />
                  <span className="font-display text-lg font-semibold">3D AQI skyline</span>
                </div>
                <p className="max-w-md text-[13px] leading-relaxed text-text-mid">
                  Pollution rendered with physical height — pan, tilt and orbit a live city of pollution.
                  Click any station for its forecast, attribution and advisory.
                </p>
              </div>
              <div className="mt-5 flex h-16 items-end gap-1">
                {[60, 120, 80, 210, 150, 95, 300, 180, 70, 130, 240, 110, 90, 160, 50].map((aqi, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all duration-300 group-hover:opacity-90"
                    style={{ height: `${Math.min(100, (aqi / 320) * 100)}%`, background: aqiColor(aqi), opacity: 0.8 }}
                  />
                ))}
              </div>
            </Link>
          </Reveal>

          {[
            { href: "/forecast", icon: TrendingUp, t: "72-hour forecast", d: "Per-ward PM2.5 with p10–p90 uncertainty bands; beats persistence on held-out data." },
            { href: "/enforcement", icon: ShieldAlert, t: "Enforcement queue", d: "Inspection priorities ranked by severity × trend × actionability × exposure." },
            { href: "/advisories", icon: Languages, t: "Citizen advisories", d: "Ward-level multilingual health guidance for vulnerable groups." },
            { href: "/validation", icon: FlaskConical, t: "Validation lab", d: "RMSE vs persistence, predicted-vs-actual proof, calibration coverage." },
            { href: "/compare", icon: BarChart3, t: "National compare", d: "Six cities ranked side by side — who is worst, who is improving." },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 50}>
              <Link href={f.href} className="card card-hover group flex h-full flex-col p-5">
                <div className="mb-3 flex items-center gap-2 text-text-hi">
                  <f.icon size={17} strokeWidth={1.6} />
                  <span className="font-display text-base font-semibold">{f.t}</span>
                  <ArrowRight size={14} className="ml-auto text-text-low transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-text" />
                </div>
                <p className="text-[13px] leading-relaxed text-text-mid">{f.d}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ─────────────────────────────────────── */}
      <section className="border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-7xl overflow-hidden px-5 py-20 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-50" style={DOTS} />
          <Reveal className="relative">
            <div className="mx-auto mb-4 flex w-fit overflow-hidden rounded">
              {AQI_BANDS.map((b) => <span key={b.label} className="h-1 w-10" style={{ background: b.color }} />)}
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-4xl">Open the console.</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-text-mid">
              Six Indian cities, live. Forecasts, attribution and advisories in one place.
            </p>
            <Link href="/console" className="btn mt-6 px-5 py-2.5 text-[15px]">
              Launch VayuNetra <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row">
            <div className="flex items-center gap-2 text-text-low">
              <Logo size={22} />
              <span className="font-mono text-[11px]">VayuNetra · वायु नेत्र · built for Indian cities · CPCB AQI</span>
            </div>
            <a
              href="https://github.com/roybishal362/VayuNetra-Urban-Air-Quality-Intelligence"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text-low transition-colors hover:text-text"
            >
              <Github size={14} /> source
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
