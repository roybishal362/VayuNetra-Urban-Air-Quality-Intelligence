"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { City, CityIntelligence } from "./types";

interface CityCtx {
  cities: City[];
  cityId: string;
  setCityId: (id: string) => void;
  city: City | null;
  intel: CityIntelligence | null;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<CityCtx | null>(null);

export function useCity(): CityCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCity must be used within <CityProvider>");
  return c;
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [intel, setIntel] = useState<CityIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-city bundle cache: revisiting a city shows its data instantly and refreshes in the
  // background, instead of blanking to a spinner on every switch (client-side SWR).
  const intelCache = useRef<Record<string, CityIntelligence>>({});

  useEffect(() => {
    api.cities()
      .then((cs) => { setCities(cs); setCityId((prev) => prev || cs[0]?.id || ""); })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    const cached = intelCache.current[cityId];
    if (cached) { setIntel(cached); setError(null); setLoading(false); }   // instant from cache
    else { setIntel(null); setError(null); setLoading(true); }             // first visit → spinner
    api.intelligence(cityId)
      .then((it) => { if (cancelled) return; intelCache.current[cityId] = it; setIntel(it); setError(null); })
      .catch((e) => { if (!cancelled && !intelCache.current[cityId]) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cityId]);

  // Keep the data live: silently re-pull intelligence every 5 min and whenever the tab
  // regains focus. No spinner, no flash — just swap in the fresher bundle as the backend
  // refreshes from Open-Meteo. The backend serves cached data instantly and revalidates
  // in the background, so these polls are cheap.
  useEffect(() => {
    if (!cityId) return;
    let stop = false;
    const refresh = () => {
      api.intelligence(cityId).then((it) => { if (!stop) { intelCache.current[cityId] = it; setIntel(it); } }).catch(() => {});
    };
    const id = window.setInterval(refresh, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stop = true; window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [cityId]);

  const city = cities.find((c) => c.id === cityId) ?? null;

  return (
    <Ctx.Provider value={{ cities, cityId, setCityId, city, intel, loading, error }}>
      {children}
    </Ctx.Provider>
  );
}
