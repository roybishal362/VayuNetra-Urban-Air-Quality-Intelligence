"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { textOn } from "@/lib/aqi";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface Props {
  city: City;
  grid: GridResponse | null;
  attributions: ZoneAttribution[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

function cellPolygon(lat: number, lon: number, stepKm: number) {
  const dLat = stepKm / 111 / 2;
  const dLon = stepKm / (111 * Math.cos((lat * Math.PI) / 180)) / 2;
  return [[
    [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat],
  ]];
}

function gridFC(grid: GridResponse | null): GeoJSON.FeatureCollection {
  if (!grid) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: grid.cells.map((c) => ({
      type: "Feature",
      properties: { color: c.color },
      geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, grid.step_km) },
    })),
  };
}

function zonesFC(city: City, attrs: ZoneAttribution[]): GeoJSON.FeatureCollection {
  const byId = new Map(attrs.map((a) => [a.zone_id, a]));
  return {
    type: "FeatureCollection",
    features: city.zones.map((z) => {
      const a = byId.get(z.id);
      const color = a ? a.contributions[0]?.color ?? "#94a3b8" : "#94a3b8";
      const aqiSwatch = a?.category === "Severe" ? "#AF2D24" : a ? "#0f172a" : "#334155";
      return {
        type: "Feature",
        properties: {
          id: z.id, name: z.name,
          aqi: a?.aqi ?? 0, label: a ? String(a.aqi) : "—",
          ring: a?.contributions[0]?.color ?? "#64748b",
          textColor: textOn(aqiSwatch),
          fill: aqiSwatch,
        },
        geometry: { type: "Point", coordinates: [z.center.lon, z.center.lat] },
      };
    }),
  };
}

export default function AirMap({ city, grid, attributions, selectedZoneId, onSelectZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [ready, setReady] = useState(false);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [city.center.lon, city.center.lat],
      zoom: 9.4,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });

    map.on("load", () => {
      map.addSource("grid", { type: "geojson", data: gridFC(null) });
      map.addLayer({
        id: "grid-fill", type: "fill", source: "grid",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.42 },
      });
      map.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "zone-ring", type: "circle", source: "zones",
        paint: {
          "circle-radius": 17, "circle-color": "#0b1120", "circle-opacity": 0.9,
          "circle-stroke-width": 2.5, "circle-stroke-color": ["get", "ring"],
        },
      });
      map.addLayer({
        id: "zone-label", type: "symbol", source: "zones",
        layout: { "text-field": ["get", "label"], "text-size": 12, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true },
        paint: { "text-color": ["get", "textColor"] },
      });
      map.addLayer({
        id: "zone-selected", type: "circle", source: "zones",
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 24, "circle-color": "transparent", "circle-stroke-width": 3, "circle-stroke-color": "#38bdf8" },
      });

      map.on("mouseenter", "zone-ring", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (f && popupRef.current) {
          const p = f.properties as Record<string, string>;
          popupRef.current
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(`<div class="text-xs"><div class="font-semibold">${p.name}</div><div class="text-slate-300">AQI ${p.aqi}</div></div>`)
            .addTo(map);
        }
      });
      map.on("mouseleave", "zone-ring", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
      map.on("click", "zone-ring", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectZone(id);
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // grid updates
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(gridFC(grid));
  }, [ready, grid]);

  // zones + selection updates
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("zones") as maplibregl.GeoJSONSource | undefined)?.setData(zonesFC(city, attributions));
    if (map.getLayer("zone-selected")) {
      map.setFilter("zone-selected", ["==", ["get", "id"], selectedZoneId ?? ""]);
    }
  }, [ready, city, attributions, selectedZoneId]);

  // fit to city on change
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const b = city.bbox;
    map.fitBounds([[b.min_lon, b.min_lat], [b.max_lon, b.max_lat]], { padding: 70, duration: 700 });
  }, [ready, city]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
