"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useCity } from "@/lib/cityStore";
import type { GridResponse } from "@/lib/types";
import BottomStrip from "@/components/BottomStrip";
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

export default function CommandCenter() {
  const { cityId, city, intel, loading, error, setCityId } = useCity();
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [time, setTime] = useState<TimeValue>({ layer: "current", horizon: 0 });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showIndustry, setShowIndustry] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelectedZoneId(null); setTime({ layer: "current", horizon: 0 }); }, [cityId]);

  useEffect(() => {
    if (!cityId || !intel) return;
    let cancelled = false;
    api.grid(cityId, time.layer, time.horizon).then((g) => !cancelled && setGrid(g)).catch(() => {});
    return () => { cancelled = true; };
  }, [cityId, time, intel]);

  useEffect(() => { sidebarRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [tab, selectedZoneId]);

  const attribution = intel?.attributions.find((a) => a.zone_id === selectedZoneId);
  const advisory = intel?.advisories.find((a) => a.zone_id === selectedZoneId);
  const onSelectZone = useCallback((id: string) => { setSelectedZoneId(id); setTab("zone"); }, []);

  if (error && !city) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-400">Cannot reach the API</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <p className="mt-3 text-xs text-slate-500">Expected at <code className="text-slate-300">{api.base}</code>.</p>
        </div>
      </div>
    );
  }
  if (!city) return <div className="grid h-full place-items-center text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <AirMap
            city={city}
            grid={grid}
            attributions={intel?.attributions ?? []}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
            industrial={intel?.landuse?.industrial}
            showIndustry={showIndustry}
          />
          <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
            <TimeControl value={time} onChange={setTime} />
            {time.layer === "forecast" && (
              <div className="card px-3 py-1.5 text-xs text-slate-200">Predicted AQI · +{time.horizon}h</div>
            )}
          </div>
          {loading && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/40 backdrop-blur-sm">
              <div className="card px-4 py-3 text-sm text-slate-200">Building intelligence…</div>
            </div>
          )}
        </div>
        {intel && (
          <BottomStrip intel={intel} showIndustry={showIndustry} onToggleIndustry={() => setShowIndustry((s) => !s)} />
        )}
      </div>

      <aside className="flex w-[400px] flex-shrink-0 flex-col border-l border-ink-700 bg-ink-900/60 backdrop-blur xl:w-[440px]">
        <div className="flex flex-shrink-0 border-b border-ink-700">
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
