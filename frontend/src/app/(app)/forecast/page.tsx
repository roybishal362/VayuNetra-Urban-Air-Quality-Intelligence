"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useCity } from "@/lib/cityStore";
import ZonePanel from "@/components/ZonePanel";
import StateMsg from "@/components/StateMsg";
import { aqiColor } from "@/lib/aqi";

export default function ForecastPage() {
  const { city, intel, error } = useCity();
  const [zoneId, setZoneId] = useState<string | null>(null);

  useEffect(() => { setZoneId(city?.zones[0]?.id ?? null); }, [city?.id]);

  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load forecast data" detail={error} />;
  if (!city || !intel) return <StateMsg title="Loading forecast…" />;
  const attrById = new Map(intel.attributions.map((a) => [a.zone_id, a]));
  const attribution = zoneId ? attrById.get(zoneId) : undefined;
  const advisory = intel.advisories.find((a) => a.zone_id === zoneId);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="max-h-[38%] w-full flex-shrink-0 overflow-y-auto border-b border-ink-700 p-3 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        <div className="mb-2 px-1 text-xs uppercase tracking-wider text-slate-500">{city.name} · {city.zones.length} wards</div>
        <div className="space-y-1">
          {city.zones.map((z) => {
            const a = attrById.get(z.id);
            return (
              <button
                key={z.id}
                onClick={() => setZoneId(z.id)}
                className={clsx(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  z.id === zoneId ? "bg-ink-700 text-slate-100" : "text-slate-300 hover:bg-ink-800",
                )}
              >
                <span className="truncate">{z.name}</span>
                {a && <span className="flex-shrink-0 font-mono text-xs" style={{ color: aqiColor(a.aqi) }}>{a.aqi}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="max-w-2xl">
          <h1 className="mb-3 font-display text-xl font-bold text-slate-100">Forecast explorer</h1>
          {zoneId ? (
            <ZonePanel city={city} zoneId={zoneId} attribution={attribution} advisory={advisory} />
          ) : (
            <div className="text-slate-500">Select a ward.</div>
          )}
        </div>
      </div>
    </div>
  );
}
