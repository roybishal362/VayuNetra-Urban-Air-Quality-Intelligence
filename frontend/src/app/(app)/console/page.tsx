"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Play, Pause } from "lucide-react";
import { api } from "@/lib/api";
import { useCity } from "@/lib/cityStore";
import type { GridResponse } from "@/lib/types";
import type { Basemap } from "@/components/AirMap";
import BottomStrip from "@/components/BottomStrip";
import TimeControl from "@/components/TimeControl";
import type { TimeValue } from "@/components/TimeControl";
import OverviewPanel from "@/components/OverviewPanel";
import EnforcementPanel from "@/components/EnforcementPanel";
import MetricsPanel from "@/components/MetricsPanel";
import ZonePanel from "@/components/ZonePanel";

const AirMap = dynamic(() => import("@/components/AirMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-text-low">Loading map…</div>,
});

type Tab = "overview" | "enforce" | "zone" | "metrics";
const gridKey = (t: TimeValue) => `${t.layer}-${t.horizon}`;

function Placeholder({ text }: { text: string }) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm text-text-low">{text}</div>;
}

export default function CommandCenter() {
  const { cityId, city, intel, loading, error, setCityId } = useCity();
  const [gridCache, setGridCache] = useState<Record<string, GridResponse>>({});
  const [time, setTime] = useState<TimeValue>({ layer: "current", horizon: 0 });
  const [playing, setPlaying] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showIndustry, setShowIndustry] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("dark");
  const [is3D, setIs3D] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const TLAPSE = useMemo<TimeValue[]>(() => [
    { layer: "current", horizon: 0 }, { layer: "forecast", horizon: 24 },
    { layer: "forecast", horizon: 48 }, { layer: "forecast", horizon: 72 },
  ], []);
  const grid = gridCache[gridKey(time)] ?? null;
  const cacheReady = TLAPSE.every((t) => gridCache[gridKey(t)]);

  // city wind = mean speed + circular-mean direction across wards (for the wind animation)
  const wind = useMemo(() => {
    const a = (intel?.attributions ?? []).filter((x) => x.wind_dir != null);
    if (!a.length) return null;
    const speed = a.reduce((s, x) => s + (x.wind_speed ?? 0), 0) / a.length;
    let sx = 0, sy = 0;
    for (const x of a) { const r = ((x.wind_dir as number) * Math.PI) / 180; sx += Math.cos(r); sy += Math.sin(r); }
    const dir = (((Math.atan2(sy, sx) * 180) / Math.PI) + 360) % 360;
    return { dir, speed };
  }, [intel]);

  useEffect(() => { setSelectedZoneId(null); setTime({ layer: "current", horizon: 0 }); setPlaying(false); }, [cityId]);

  // pre-fetch every horizon grid so the time-lapse plays smoothly
  useEffect(() => {
    if (!cityId || !intel) return;
    let cancelled = false;
    setGridCache({});
    Promise.all(TLAPSE.map((t) =>
      api.grid(cityId, t.layer, t.horizon).then((g) => [gridKey(t), g] as const).catch(() => null),
    )).then((res) => {
      if (cancelled) return;
      const c: Record<string, GridResponse> = {};
      for (const r of res) if (r) c[r[0]] = r[1];
      setGridCache(c);
    });
    return () => { cancelled = true; };
  }, [cityId, intel, TLAPSE]);

  // time-lapse playback — cycle Now → +24h → +48h → +72h (skyline rises/falls smoothly)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime((cur) => {
        const i = TLAPSE.findIndex((t) => t.layer === cur.layer && t.horizon === cur.horizon);
        return TLAPSE[(i + 1) % TLAPSE.length];
      });
    }, 2000);
    return () => clearInterval(id);
  }, [playing, TLAPSE]);

  useEffect(() => { sidebarRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [tab, selectedZoneId]);

  const attribution = intel?.attributions.find((a) => a.zone_id === selectedZoneId);
  const advisory = intel?.advisories.find((a) => a.zone_id === selectedZoneId);
  const onSelectZone = useCallback((id: string) => { setSelectedZoneId(id); setTab("zone"); }, []);

  if (error && !city) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-[#E93F33]">Cannot reach the API</h1>
          <p className="mt-2 text-sm text-text-mid">{error}</p>
          <p className="mt-3 text-xs text-text-low">Expected at <code className="text-text">{api.base}</code>.</p>
        </div>
      </div>
    );
  }
  if (!city) return <div className="grid h-full place-items-center text-text-mid">Loading…</div>;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* map toolbar — all map controls live here, never floating over the markers */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] bg-vn-900/50 px-3 py-2 backdrop-blur">
          <TimeControl value={time} onChange={setTime} />
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!cacheReady}
            title={playing ? "Pause forecast time-lapse" : "Play the 72-hour forecast time-lapse"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-vn-750/60 px-2.5 py-1.5 text-[11px] font-medium text-text transition-colors hover:border-white/[0.14] hover:text-text-hi disabled:opacity-40"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? "Pause" : "Time-lapse"}
          </button>
          {time.layer === "forecast" && (
            <span className="rounded-md border border-white/[0.08] bg-vn-800/60 px-2.5 py-1 font-mono text-[11px] text-text">Predicted · +{time.horizon}h</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-vn-850/60 p-1">
              {(["dark", "streets", "sat"] as Basemap[]).map((bm) => (
                <button key={bm} onClick={() => setBasemap(bm)}
                  className={clsx("rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors duration-fast",
                    basemap === bm ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi")}>
                  {bm === "sat" ? "Satellite" : bm}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-vn-850/60 p-1">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => setIs3D(v)}
                  className={clsx("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-fast",
                    is3D === v ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi")}>
                  {v ? "3D" : "2D"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <AirMap
            city={city}
            grid={grid}
            attributions={intel?.attributions ?? []}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
            industrial={intel?.landuse?.industrial}
            showIndustry={showIndustry}
            basemap={basemap}
            is3D={is3D}
            wind={wind}
          />
          {loading && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-vn-base/40 backdrop-blur-sm">
              <div className="glass px-4 py-3 text-sm text-text">Building intelligence…</div>
            </div>
          )}
        </div>
        {intel && (
          <BottomStrip intel={intel} showIndustry={showIndustry} onToggleIndustry={() => setShowIndustry((s) => !s)} />
        )}
      </div>

      <aside className="flex w-[360px] flex-shrink-0 flex-col border-l border-white/[0.06] bg-vn-900/60 backdrop-blur-xl lg:w-[400px] xl:w-[440px]">
        <div role="tablist" aria-label="Detail panels" className="flex flex-shrink-0 border-b border-white/[0.06] px-2 pt-2">
          {(["overview", "enforce", "zone", "metrics"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={clsx(
                "relative flex-1 rounded-t-lg py-2.5 text-sm font-medium capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                tab === t ? "text-text-hi" : "text-text-mid hover:text-text",
              )}
            >
              {t === "enforce" ? "Enforce" : t === "metrics" ? "Validation" : t}
              {tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-text-hi" />}
            </button>
          ))}
        </div>
        <div key={`${tab}-${selectedZoneId ?? ""}`} ref={sidebarRef} className="vn-fade min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "overview" &&
            (intel ? <OverviewPanel intel={intel} onSelectZone={onSelectZone} onCity={setCityId} activeCityId={cityId} /> : <Placeholder text="Loading overview…" />)}
          {tab === "enforce" &&
            (intel ? <EnforcementPanel city={city} items={intel.enforcement} onSelectZone={onSelectZone} /> : <Placeholder text="Loading…" />)}
          {tab === "zone" &&
            (selectedZoneId && intel ? (
              <ZonePanel city={city} zoneId={selectedZoneId} attribution={attribution} advisory={advisory} />
            ) : (
              <Placeholder text="Click a station on the map to see its 72-hour forecast, source attribution and citizen advisory." />
            ))}
          {tab === "metrics" && (intel ? <MetricsPanel intel={intel} /> : <Placeholder text="Loading…" />)}
        </div>
      </aside>
    </div>
  );
}
