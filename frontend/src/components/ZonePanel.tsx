"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdvisoryItem, City, ZoneAttribution, ZoneForecast } from "@/lib/types";
import { aqiColor, textOn } from "@/lib/aqi";
import ForecastChart from "./ForecastChart";
import AttributionCard from "./AttributionCard";
import AdvisoryCard from "./AdvisoryCard";

interface Props {
  city: City;
  zoneId: string;
  attribution?: ZoneAttribution;
  advisory?: AdvisoryItem;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      {children}
    </div>
  );
}

export default function ZonePanel({ city, zoneId, attribution, advisory }: Props) {
  const [forecast, setForecast] = useState<ZoneForecast | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const zone = city.zones.find((z) => z.id === zoneId);

  useEffect(() => {
    let cancelled = false;
    setForecast(null);
    setErr(null);
    api
      .zoneForecast(city.id, zoneId)
      .then((f) => !cancelled && setForecast(f))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [city.id, zoneId]);

  const aqi = attribution?.aqi ?? 0;
  const color = aqiColor(aqi);

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between p-3">
        <div>
          <div className="text-lg font-semibold text-slate-100">{zone?.name ?? zoneId}</div>
          <div className="text-xs text-slate-400">{attribution?.category ?? "—"}</div>
        </div>
        <div
          className="grid h-14 w-16 place-items-center rounded-lg font-mono text-2xl font-bold"
          style={{ background: color, color: textOn(color) }}
        >
          {aqi || "—"}
        </div>
      </div>

      <Section title="PM2.5 forecast · next 72h">
        {forecast ? (
          <ForecastChart points={forecast.points} />
        ) : err ? (
          <div className="h-48 grid place-items-center text-sm text-rose-400">{err}</div>
        ) : (
          <div className="h-48 grid place-items-center text-sm text-slate-500">Loading forecast…</div>
        )}
      </Section>

      {attribution && (
        <Section title="Source attribution">
          <AttributionCard attr={attribution} />
        </Section>
      )}

      {advisory && (
        <Section title="Citizen advisory">
          <AdvisoryCard advisory={advisory} />
        </Section>
      )}
    </div>
  );
}
