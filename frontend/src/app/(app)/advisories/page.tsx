"use client";

import { useCity } from "@/lib/cityStore";
import AdvisoryCard from "@/components/AdvisoryCard";

export default function AdvisoriesPage() {
  const { city, intel } = useCity();
  if (!intel || !city) return <div className="grid h-full place-items-center text-slate-400">Loading advisories…</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">Citizen health advisories — {city.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ward-level, multilingual ({city.languages.join(" · ")}). {intel.advisories.length} priority wards.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {intel.advisories.map((a) => (
            <div key={a.zone_id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold text-slate-100">{a.zone_name}</div>
                <span className="font-mono text-sm" style={{ color: a.color }}>AQI {a.peak_aqi}</span>
              </div>
              <AdvisoryCard advisory={a} />
            </div>
          ))}
        </div>

        {intel.advisories.length === 0 && (
          <p className="text-sm text-slate-500">No advisories needed — air quality is acceptable across wards.</p>
        )}
      </div>
    </div>
  );
}
