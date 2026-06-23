"use client";

import { useRouter } from "next/navigation";
import { useCity } from "@/lib/cityStore";
import EnforcementPanel from "@/components/EnforcementPanel";

export default function EnforcementPage() {
  const { city, intel } = useCity();
  const router = useRouter();
  if (!city || !intel) return <div className="grid h-full place-items-center text-slate-400">Loading enforcement…</div>;
  const top = intel.enforcement[0];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">Enforcement priorities — {city.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Evidence-backed inspection queue, ranked by severity × forecast trend × source actionability × population exposure.
          </p>
        </header>

        {top && (
          <div className="card border-brand/30 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Act first</div>
            <div className="mt-1 text-lg font-semibold text-slate-100">{top.zone_name} · {top.dominant_label}</div>
            <p className="mt-1 text-sm text-slate-300">{top.recommended_action}</p>
          </div>
        )}

        <EnforcementPanel city={city} items={intel.enforcement} onSelectZone={() => router.push("/console")} />
      </div>
    </div>
  );
}
