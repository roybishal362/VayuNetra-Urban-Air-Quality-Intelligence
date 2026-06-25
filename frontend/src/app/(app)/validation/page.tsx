"use client";

import { useCity } from "@/lib/cityStore";
import MetricsPanel from "@/components/MetricsPanel";
import AttributionValidationCard from "@/components/AttributionValidationCard";
import StateMsg from "@/components/StateMsg";

export default function ValidationPage() {
  const { city, intel, error } = useCity();
  if (error && !intel) return <StateMsg kind="error" title="Couldn’t load validation data" detail={error} />;
  if (!intel || !city) return <StateMsg title="Loading validation…" />;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">Model validation — {city.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Held-out evaluation: forecast skill vs persistence, predicted-vs-actual proof, uncertainty
            calibration — and our source attribution checked against published receptor-model studies.
          </p>
        </header>
        <AttributionValidationCard cityId={city.id} />
        <MetricsPanel intel={intel} />
      </div>
    </div>
  );
}
