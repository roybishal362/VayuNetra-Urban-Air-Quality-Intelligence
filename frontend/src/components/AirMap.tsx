"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn } from "@/lib/aqi";

// Inline style: parses instantly (so our data layers always load, even if the raster
// basemap is blocked by a corporate network). Raster tiles degrade to the dark background.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1120" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.85 } },
  ],
};

interface Props {
  city: City;
  grid: GridResponse | null;
  attributions: ZoneAttribution[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  industrial?: { lat: number; lon: number }[];
  showIndustry?: boolean;
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

export default function AirMap({
  city, grid, attributions, selectedZoneId, onSelectZone, industrial, showIndustry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const selectRef = useRef(onSelectZone);
  selectRef.current = onSelectZone;
  const [ready, setReady] = useState(false);

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

    // Idempotent so StrictMode double-mount / a missed 'load' can't leave the map un-ready.
    const onReady = () => {
      if (!map.getSource("grid")) {
        map.addSource("grid", { type: "geojson", data: gridFC(null) });
        map.addLayer({
          id: "grid-fill", type: "fill", source: "grid",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 },
        });
      }
      if (!map.getSource("industry")) {
        map.addSource("industry", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "industry", type: "circle", source: "industry",
          paint: {
            "circle-radius": 3.5, "circle-color": "#E67E22", "circle-opacity": 0.85,
            "circle-stroke-width": 0.5, "circle-stroke-color": "#7c3a0f",
          },
        });
      }
      map.resize();
      setReady(true);
    };
    map.on("load", onReady);
    map.once("idle", onReady); // backstop if the 'load' event is missed

    // Fix the classic flexbox sizing race: resize whenever the container changes size.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      popupRef.current?.remove();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // grid layer updates
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(gridFC(grid));
  }, [ready, grid]);

  // industry overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const feats = (showIndustry && industrial)
      ? industrial.map((p) => ({
          type: "Feature" as const, properties: {},
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        }))
      : [];
    (map.getSource("industry") as maplibregl.GeoJSONSource | undefined)
      ?.setData({ type: "FeatureCollection", features: feats });
  }, [ready, industrial, showIndustry]);

  // selected-zone callout popup (immediate on-map feedback) + gentle focus
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!selectedZoneId) return;

    const z = city.zones.find((zz) => zz.id === selectedZoneId);
    if (!z) return;
    const a = attributions.find((x) => x.zone_id === selectedZoneId);
    const aqi = a?.aqi ?? 0;
    const color = aqi ? aqiColor(aqi) : "#64748b";
    const top = a?.contributions?.[0];
    const html =
      `<div style="min-width:148px">` +
      `<div style="font-weight:600;font-size:13px;color:#e2e8f0">${z.name}</div>` +
      `<div style="display:flex;align-items:center;gap:8px;margin-top:6px">` +
        `<div style="background:${color};color:${textOn(color)};font-weight:700;font-size:18px;border-radius:6px;padding:1px 8px;font-family:ui-monospace,monospace">${aqi || "—"}</div>` +
        `<div style="font-size:11px;color:#94a3b8">${a?.category ?? ""}</div>` +
      `</div>` +
      (top ? `<div style="margin-top:6px;font-size:11px;color:#cbd5e1"><span style="color:${top.color}">●</span> ${top.label} · ${top.pct.toFixed(0)}%</div>` : "") +
      `<div style="margin-top:4px;font-size:10px;color:#64748b">full detail in the Zone panel →</div>` +
      `</div>`;

    popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 16, maxWidth: "240px" })
      .setLngLat([z.center.lon, z.center.lat])
      .setHTML(html)
      .addTo(map);
    map.easeTo({ center: [z.center.lon, z.center.lat], duration: 500,
                 padding: { top: 80, right: 430, bottom: 0, left: 0 } });
  }, [ready, selectedZoneId, attributions, city]);

  // zone HTML markers (no glyph dependency, full styling control)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const byId = new Map(attributions.map((a) => [a.zone_id, a]));

    for (const z of city.zones) {
      const a = byId.get(z.id);
      const aqi = a?.aqi ?? 0;
      const color = aqi ? aqiColor(aqi) : "#475569";
      const selected = z.id === selectedZoneId;
      const el = document.createElement("div");
      el.textContent = aqi ? String(aqi) : "–";
      el.title = `${z.name} · AQI ${aqi || "n/a"}`;
      el.style.cssText =
        `display:grid;place-items:center;width:32px;height:32px;border-radius:9999px;` +
        `background:${color};color:${textOn(color)};font:600 12px ui-sans-serif,system-ui;` +
        `border:2px solid ${selected ? "#38bdf8" : "rgba(11,17,32,.85)"};` +
        `box-shadow:0 0 0 1px rgba(0,0,0,.35)${selected ? ",0 0 0 4px rgba(56,189,248,.35)" : ""};` +
        `cursor:pointer;transition:transform .1s;`;
      if (aqi >= 401) el.classList.add("vn-pulse");
      el.onmouseenter = () => (el.style.transform = "scale(1.15)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");
      el.onclick = (e) => { e.stopPropagation(); selectRef.current(z.id); };
      const marker = new maplibregl.Marker({ element: el }).setLngLat([z.center.lon, z.center.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, city, attributions, selectedZoneId]);

  // fit to city on change
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const b = city.bbox;
    map.fitBounds([[b.min_lon, b.min_lat], [b.max_lon, b.max_lat]],
      { padding: { top: 90, right: 430, bottom: 30, left: 30 }, duration: 700 });
  }, [ready, city]);

  // NOTE: maplibre-gl.css forces `.maplibregl-map { position: relative }`, which overrides a
  // Tailwind `absolute` (equal specificity, later in bundle) and collapses height. Size via
  // h-full/w-full against the definite-height parent instead.
  return <div ref={containerRef} className="h-full w-full" />;
}
