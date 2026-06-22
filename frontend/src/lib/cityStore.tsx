"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    api.cities()
      .then((cs) => { setCities(cs); setCityId((prev) => prev || cs[0]?.id || ""); })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    setLoading(true); setError(null); setIntel(null);
    api.intelligence(cityId)
      .then((it) => !cancelled && setIntel(it))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [cityId]);

  const city = cities.find((c) => c.id === cityId) ?? null;

  return (
    <Ctx.Provider value={{ cities, cityId, setCityId, city, intel, loading, error }}>
      {children}
    </Ctx.Provider>
  );
}
