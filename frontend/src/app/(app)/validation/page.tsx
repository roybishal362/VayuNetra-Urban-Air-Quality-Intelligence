"use client";

import { useCity } from "@/lib/cityStore";
import MetricsPanel from "@/components/MetricsPanel";
import StateMsg from "@/components/StateMsg";

export default function ValidationPage() {
  const { city, intel, error } = useCity();
  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load validation data" detail={error} />;
  if (!intel || !city) return <StateMsg title="Loading validation…" />;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">Model validation — {city.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Held-out evaluation: skill vs persistence, predicted-vs-actual proof, and uncertainty calibration.
            A separate model is trained and validated per city.
          </p>
        </header>
        <MetricsPanel intel={intel} />
      </div>
    </div>
  );
}
