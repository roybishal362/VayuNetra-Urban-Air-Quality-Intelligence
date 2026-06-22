"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdvisoryItem, City, HistoryPoint, ZoneAttribution, ZoneForecast } from "@/lib/types";
import { aqiColor, textOn } from "@/lib/aqi";
import HistoryForecastChart from "./HistoryForecastChart";
import AttributionCard from "./AttributionCard";
import AdvisoryCard from "./AdvisoryCard";
import WhatIfCard from "./WhatIfCard";

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
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const zone = city.zones.find((z) => z.id === zoneId);

  useEffect(() => {
    let cancelled = false;
    setForecast(null); setHistory(null); setErr(null);
    api.zoneForecast(city.id, zoneId).then((f) => !cancelled && setForecast(f)).catch((e) => !cancelled && setErr(String(e)));
    api.zoneHistory(city.id, zoneId, 48).then((h) => !cancelled && setHistory(h.points)).catch(() => !cancelled && setHistory([]));
    return () => { cancelled = true; };
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
        <div className="grid h-14 w-16 place-items-center rounded-lg font-mono text-2xl font-bold" style={{ background: color, color: textOn(color) }}>
          {aqi || "—"}
        </div>
      </div>

      <Section title="PM2.5 · last 48h + 72h forecast">
        {forecast ? (
          <HistoryForecastChart history={history ?? []} forecast={forecast.points} nowTs={forecast.issued_at} />
        ) : err ? (
          <div className="grid h-52 place-items-center text-sm text-rose-400">{err}</div>
        ) : (
          <div className="grid h-52 place-items-center text-sm text-slate-500">Loading…</div>
        )}
      </Section>

      {attribution && (
        <Section title="Source attribution"><AttributionCard attr={attribution} /></Section>
      )}

      {attribution && (
        <Section title="What-if · intervention simulator"><WhatIfCard city={city} attribution={attribution} /></Section>
      )}

      {advisory && (
        <Section title="Citizen advisory"><AdvisoryCard advisory={advisory} /></Section>
      )}
    </div>
  );
}
