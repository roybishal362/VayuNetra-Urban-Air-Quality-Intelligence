"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { City, CityIntelligence, GridResponse } from "@/lib/types";
import Topbar from "@/components/Topbar";
import Legend from "@/components/Legend";
import TimeControl from "@/components/TimeControl";
import type { TimeValue } from "@/components/TimeControl";
import OverviewPanel from "@/components/OverviewPanel";
import EnforcementPanel from "@/components/EnforcementPanel";
import MetricsPanel from "@/components/MetricsPanel";
import ZonePanel from "@/components/ZonePanel";

const AirMap = dynamic(() => import("@/components/AirMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-slate-500">Loading map…</div>,
});

type Tab = "overview" | "enforce" | "zone" | "metrics";

function Placeholder({ text }: { text: string }) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">{text}</div>;
}

export default function Page() {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [intel, setIntel] = useState<CityIntelligence | null>(null);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [time, setTime] = useState<TimeValue>({ layer: "current", horizon: 0 });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showIndustry, setShowIndustry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.cities()
      .then((cs) => { setCities(cs); setCityId(cs[0]?.id ?? ""); })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    setLoading(true); setError(null); setIntel(null); setGrid(null);
    setSelectedZoneId(null); setTime({ layer: "current", horizon: 0 });
    api.intelligence(cityId)
      .then((it) => !cancelled && setIntel(it))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [cityId]);

  useEffect(() => {
    if (!cityId || !intel) return;
    let cancelled = false;
    api.grid(cityId, time.layer, time.horizon)
      .then((g) => !cancelled && setGrid(g))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cityId, time, intel]);

  useEffect(() => {
    sidebarRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, selectedZoneId]);

  const city = cities.find((c) => c.id === cityId) ?? null;
  const attribution = intel?.attributions.find((a) => a.zone_id === selectedZoneId);
  const advisory = intel?.advisories.find((a) => a.zone_id === selectedZoneId);

  const onSelectZone = useCallback((id: string) => { setSelectedZoneId(id); setTab("zone"); }, []);

  if (!cities.length && error) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="glass max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-400">Cannot reach the API</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <p className="mt-3 text-xs text-slate-500">
            Expected at <code className="text-slate-300">{api.base}</code>. Start the backend, or set{" "}
            <code className="text-slate-300">NEXT_PUBLIC_API_BASE</code>.
          </p>
        </div>
      </main>
    );
  }

  if (!city) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center text-slate-400">
          <div className="font-display text-2xl font-bold text-brand">VayuNetra</div>
          <div className="mt-1 text-sm">Loading cities…</div>
        </div>
      </main>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
        <AirMap
          city={city}
          grid={grid}
          attributions={intel?.attributions ?? []}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          industrial={intel?.landuse?.industrial}
          showIndustry={showIndustry}
        />
      </div>

      <Topbar cities={cities} cityId={cityId} onCity={setCityId} intel={intel} />

      <div className="absolute left-3 top-20 z-20 flex flex-col items-start gap-2">
        <TimeControl value={time} onChange={setTime} />
        {time.layer === "forecast" && (
          <div className="glass px-3 py-1.5 text-xs text-slate-200">Predicted AQI · +{time.horizon}h</div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20 flex items-end gap-2">
        <Legend />
        <button
          onClick={() => setShowIndustry((s) => !s)}
          className={clsx(
            "glass flex items-center gap-1.5 px-3 py-2 text-xs transition-colors",
            showIndustry ? "text-amber-300" : "text-slate-300",
          )}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "#E67E22" }} />
          Industry
        </button>
      </div>

      <aside className="glass absolute bottom-3 right-3 top-20 z-20 flex w-[400px] flex-col overflow-hidden">
        <div className="flex flex-shrink-0 border-b border-white/10">
          {(["overview", "enforce", "zone", "metrics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex-1 py-2.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "border-b-2 border-brand text-brand" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {t === "enforce" ? "Enforce" : t === "metrics" ? "Validation" : t}
            </button>
          ))}
        </div>
        <div key={tab} ref={sidebarRef} className="vn-fade min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "overview" &&
            (intel ? (
              <OverviewPanel intel={intel} onSelectZone={onSelectZone} onCity={setCityId} activeCityId={cityId} />
            ) : (
              <Placeholder text="Loading overview…" />
            ))}
          {tab === "enforce" &&
            (intel ? (
              <EnforcementPanel city={city} items={intel.enforcement} onSelectZone={onSelectZone} />
            ) : (
              <Placeholder text="Loading enforcement priorities…" />
            ))}
          {tab === "zone" &&
            (selectedZoneId && intel ? (
              <ZonePanel city={city} zoneId={selectedZoneId} attribution={attribution} advisory={advisory} />
            ) : (
              <Placeholder text="Click a station on the map to see its 72-hour forecast, source attribution and citizen advisory." />
            ))}
          {tab === "metrics" && (intel ? <MetricsPanel intel={intel} /> : <Placeholder text="Loading metrics…" />)}
        </div>
      </aside>

      {loading && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink-950/40 backdrop-blur-sm">
          <div className="glass px-4 py-3 text-sm text-slate-200">Building intelligence…</div>
        </div>
      )}
    </div>
  );
}
