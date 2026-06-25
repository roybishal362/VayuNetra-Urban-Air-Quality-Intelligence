"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GridCell, LatLon } from "@/lib/types";
import { aqiColor, textOn } from "@/lib/aqi";
import { hasWebGL } from "@/lib/webgl";

export interface HeroMarker { lat: number; lon: number; aqi: number; name: string }

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "nc5sshnRlIfoqUGKBQkq";
// Satellite + labels — a real map you recognise, not an abstract slab.
const HERO_STYLE = MAPTILER_KEY ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}` : null;

// keyless raster satellite fallback (Esri World Imagery) if no MapTiler key
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0d12" } },
    { id: "esri", type: "raster", source: "esri", paint: { "raster-opacity": 1, "raster-saturation": -0.1 } },
  ],
};

// Smooth AQI heat cloud (density ramp through the CPCB band colours).
const HEAT_COLOR: ExpressionSpecification = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(0,0,0,0)",
  0.15, "rgba(85,168,79,0.45)",
  0.35, "rgba(255,248,51,0.55)",
  0.55, "rgba(242,156,51,0.68)",
  0.78, "rgba(233,63,51,0.8)",
  1.0, "rgba(175,45,36,0.9)",
];

function pointsFC(cells: GridCell[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((c) => ({
      type: "Feature",
      properties: { aqi: c.aqi },
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    })),
  };
}

/** Non-interactive SVG choropleth — shown when WebGL isn't available so the hero never goes black. */
function HeroFallback({ cells }: { cells: GridCell[] }) {
  const box = useMemo(() => {
    if (!cells.length) return null;
    const lons = cells.map((c) => c.lon), lats = cells.map((c) => c.lat);
    return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  }, [cells]);
  if (!box) return <div className="grid h-full w-full place-items-center text-sm text-text-low">AQI map</div>;
  const W = 600;
  const midLat = (box.minLat + box.maxLat) / 2;
  const lonSpan = Math.max(1e-4, box.maxLon - box.minLon);
  const latSpan = Math.max(1e-4, box.maxLat - box.minLat);
  const H = Math.round((W * latSpan) / (lonSpan * Math.cos((midLat * Math.PI) / 180)));
  const px = (lon: number) => ((lon - box.minLon) / lonSpan) * W;
  const py = (lat: number) => ((box.maxLat - lat) / latSpan) * H;
  const size = Math.max(8, (W / Math.sqrt(cells.length)) * 0.9);
  return (
    <div className="h-full w-full bg-vn-base" role="img" aria-label="AQI grid">
      <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        {cells.map((c, i) => (
          <rect key={i} x={px(c.lon) - size / 2} y={py(c.lat) - size / 2} width={size} height={size} rx={2} fill={c.color} fillOpacity={0.6} />
        ))}
      </svg>
    </div>
  );
}

/** Hero: a real satellite map with a live AQI heat cloud + numbered station dots, slowly orbiting. */
export default function HeroMap({ cells, center, stepKm: _stepKm, markers = [] }:
  { cells: GridCell[]; center: LatLon; stepKm: number; markers?: HeroMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerObjsRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed || !containerRef.current || mapRef.current) return;
    if (!hasWebGL()) { setFailed(true); return; }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: HERO_STYLE ?? STYLE,
        center: [center.lon, center.lat],
        zoom: 9.7,
        pitch: 40,
        bearing: -18,
        interactive: false,
        attributionControl: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.on("error", (e) => {
      const msg = String(e?.error?.message ?? e?.error ?? "");
      if (/webgl|context lost|gl_|out of memory/i.test(msg)) setFailed(true);
    });
    const canvas = map.getCanvas();
    const onLost = (ev: Event) => { ev.preventDefault(); setFailed(true); };
    canvas.addEventListener("webglcontextlost", onLost, false);

    const onReady = () => {
      // Dim the bright satellite so the AQI heat + dots pop and it suits the dark UI.
      // (The dots are DOM overlays, so they stay crisp — only the imagery is dimmed.)
      try {
        for (const lyr of map.getStyle().layers ?? []) {
          if (lyr.type === "raster") {
            map.setPaintProperty(lyr.id, "raster-brightness-max", 0.7);
            map.setPaintProperty(lyr.id, "raster-saturation", -0.15);
            map.setPaintProperty(lyr.id, "raster-contrast", -0.05);
          }
        }
      } catch { /* style may have no raster layers */ }
      if (!map.getSource("cells")) {
        map.addSource("cells", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "aqi-heat", type: "heatmap", source: "cells",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "aqi"], 0, 0.05, 200, 0.5, 500, 1],
            "heatmap-intensity": 1.1,
            "heatmap-radius": 40,
            "heatmap-opacity": 0.72,
            "heatmap-color": HEAT_COLOR,
          },
        });
      }
      map.resize();
      setReady(true);
    };
    map.on("load", onReady);
    map.once("idle", onReady);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    // gentle self-orbit so it reads as a live 3D map (guarded; respects reduced-motion)
    let raf = 0;
    let bearing = -18;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const spin = () => {
      try {
        bearing = (bearing + 0.03) % 360;
        map.setBearing(bearing);
        raf = requestAnimationFrame(spin);
      } catch {
        cancelAnimationFrame(raf);
      }
    };
    if (!reduce) raf = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      markerObjsRef.current.forEach((m) => m.remove());
      markerObjsRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  // heat cloud data
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("cells") as maplibregl.GeoJSONSource | undefined)?.setData(pointsFC(cells));
  }, [ready, cells]);

  // AQI station dots — the worst ~10 wards as numbered pills (the "points of AQI")
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markerObjsRef.current.forEach((m) => m.remove());
    markerObjsRef.current = [];
    const top = [...markers].sort((a, b) => b.aqi - a.aqi).slice(0, 10);
    for (const mk of top) {
      const color = mk.aqi ? aqiColor(mk.aqi) : "#3A3B40";
      const wrap = document.createElement("div");
      const el = document.createElement("div");
      el.textContent = String(mk.aqi);
      el.title = `${mk.name}: AQI ${mk.aqi}`;
      el.style.cssText =
        `display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;` +
        `background:${color};color:${textOn(color)};` +
        `font:700 12px var(--font-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
        `border:2px solid rgba(255,255,255,.92);` +
        `box-shadow:0 2px 8px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.35);`;
      if (mk.aqi >= 401) el.classList.add("vn-pulse");
      wrap.appendChild(el);
      const marker = new maplibregl.Marker({ element: wrap }).setLngLat([mk.lon, mk.lat]).addTo(map);
      markerObjsRef.current.push(marker);
    }
  }, [ready, markers]);

  if (failed) return <HeroFallback cells={cells} />;
  return <div ref={containerRef} className="h-full w-full" role="img" aria-label="Live satellite air-quality map — heat cloud and station AQI dots" />;
}
