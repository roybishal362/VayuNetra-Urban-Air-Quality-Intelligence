"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn, AQI_BANDS } from "@/lib/aqi";
import { hasWebGL } from "@/lib/webgl";
import StaticMap from "./StaticMap";
import WindLayer from "./WindLayer";

export type Basemap = "dark" | "streets" | "sat";

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

// MapTiler vector basemaps (3D-capable). Key can be overridden via env; otherwise the
// project key is used so the premium maps work out of the box.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "nc5sshnRlIfoqUGKBQkq";
const VECTOR = !!MAPTILER_KEY;
const MAPTILER_STYLE: Record<Basemap, string> = {
  dark: `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}`,
  streets: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`,
  sat: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
};

// Keyless raster fallback (only used if the key is ever removed).
const RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap, © CARTO" },
    voyager: { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap, © CARTO" },
    esri: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "© Esri" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#08090A" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 1, "raster-saturation": -0.2 } },
    { id: "voyager", type: "raster", source: "voyager", layout: { visibility: "none" }, paint: { "raster-opacity": 1 } },
    { id: "esri", type: "raster", source: "esri", layout: { visibility: "none" }, paint: { "raster-opacity": 1 } },
  ],
};

const EXTRUSION_COLOR: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "aqi"],
  0, "#55A84F", 50, "#8FBF4A", 100, "#C9D24A", 150, "#FFF833",
  200, "#F8C238", 250, "#F29C33", 300, "#ED6B30", 400, "#E93F33", 500, "#AF2D24",
];

interface Props {
  city: City;
  grid: GridResponse | null;
  attributions: ZoneAttribution[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  industrial?: { lat: number; lon: number }[];
  showIndustry?: boolean;
  basemap: Basemap;
  is3D: boolean;
  wind?: { dir: number; speed: number } | null;
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
      properties: { aqi: c.aqi, color: c.color, height: Math.min(Math.max(c.aqi * 6, 40), 3000) },
      geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, grid.step_km) },
    })),
  };
}

// Real 3D buildings from the MapTiler vector source (the "3D city" look). Fully guarded:
// if the style has no building vector layer it simply renders nothing.
function addBuildings(map: maplibregl.Map) {
  if (!VECTOR || map.getLayer("vn-buildings")) return;
  try {
    const sources = map.getStyle()?.sources ?? {};
    const vectorSrc = Object.keys(sources).find((id) => (sources as Record<string, { type?: string }>)[id]?.type === "vector");
    if (!vectorSrc) return;
    const beforeId = map.getLayer("grid-3d") ? "grid-3d" : undefined;
    map.addLayer({
      id: "vn-buildings",
      type: "fill-extrusion",
      source: vectorSrc,
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": "#303137",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    }, beforeId);
  } catch { /* style has no building layer — fine */ }
}

// Spread overlapping station markers apart in screen space so labels stay readable
// (wards that sit close together would otherwise stack: "5" hidden behind "500").
function deoverlap(map: maplibregl.Map, markers: maplibregl.Marker[]) {
  if (markers.length < 2) return;
  const R = 34; // min centre-to-centre separation in px (markers are 30px)
  const pts = markers.map((m) => {
    const p = map.project(m.getLngLat());
    return { m, x: p.x, y: p.y, ox: 0, oy: 0 };
  });
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = (b.x + b.ox) - (a.x + a.ox);
        const dy = (b.y + b.oy) - (a.y + a.oy);
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < R) {
          const push = (R - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.ox -= ux * push; a.oy -= uy * push;
          b.ox += ux * push; b.oy += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const p of pts) p.m.setOffset([p.ox, p.oy]);
}

function addDataLayers(map: maplibregl.Map) {
  if (!map.getSource("grid")) {
    map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "grid-2d", type: "fill", source: "grid", layout: { visibility: "none" },
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.42, "fill-outline-color": "rgba(255,255,255,0.12)" },
    });
    map.addLayer({
      id: "grid-3d", type: "fill-extrusion", source: "grid",
      paint: {
        "fill-extrusion-color": EXTRUSION_COLOR,
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        // translucent so the Dark Matter basemap + 3D buildings glow through (the AQI is a glow, not a wall)
        "fill-extrusion-opacity": 0.55,
        "fill-extrusion-vertical-gradient": true,
      },
    });
  }
  if (!map.getSource("industry")) {
    map.addSource("industry", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "industry", type: "circle", source: "industry",
      paint: { "circle-radius": 3.2, "circle-color": "#E67E22", "circle-opacity": 0.9, "circle-stroke-width": 0.5, "circle-stroke-color": "#7c3a0f" },
    });
  }
  addBuildings(map);
}

export default function AirMap({
  city, grid, attributions, selectedZoneId, onSelectZone, industrial, showIndustry, basemap, is3D, wind,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const selectRef = useRef(onSelectZone);
  selectRef.current = onSelectZone;
  const gridRef = useRef(grid); gridRef.current = grid;
  const is3DRef = useRef(is3D); is3DRef.current = is3D;
  const indRef = useRef({ industrial, showIndustry }); indRef.current = { industrial, showIndustry };

  const [mode, setMode] = useState<"gl" | "static">(() => (hasWebGL() ? "gl" : "static"));
  const [ready, setReady] = useState(false);
  const [tilesBlocked, setTilesBlocked] = useState(false);

  const applyData = (map: maplibregl.Map) => {
    addDataLayers(map);
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(gridFC(gridRef.current));
    if (map.getLayer("grid-3d")) map.setLayoutProperty("grid-3d", "visibility", is3DRef.current ? "visible" : "none");
    if (map.getLayer("grid-2d")) map.setLayoutProperty("grid-2d", "visibility", is3DRef.current ? "none" : "visible");
    const { industrial: ind, showIndustry: show } = indRef.current;
    const feats = (show && ind) ? ind.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] } })) : [];
    (map.getSource("industry") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: feats });
  };

  // ── init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "gl" || !containerRef.current || mapRef.current) return;
    if (!hasWebGL()) { setMode("static"); return; }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: VECTOR ? MAPTILER_STYLE[basemap] : RASTER_STYLE,
        center: [city.center.lon, city.center.lat],
        zoom: 10, pitch: 50, bearing: -18, maxPitch: 70, attributionControl: false,
      });
    } catch { setMode("static"); return; }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("error", (e) => {
      const msg = String(e?.error?.message ?? e?.error ?? "");
      if (/webgl|context lost|gl_|out of memory/i.test(msg)) setMode("static");
      else if (/tile|fetch|network|load|403|failed/i.test(msg)) setTilesBlocked(true);
    });
    const canvas = map.getCanvas();
    const onLost = (ev: Event) => { ev.preventDefault(); setMode("static"); };
    canvas.addEventListener("webglcontextlost", onLost, false);

    const onReady = () => { applyData(map); map.resize(); map.triggerRepaint(); setReady(true); };
    map.on("load", onReady);
    map.once("idle", onReady);
    map.on("moveend", () => deoverlap(map, markersRef.current)); // re-spread markers after zoom/pan

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    const kicks = [60, 250, 700].map((d) => setTimeout(() => { const m = mapRef.current; if (m) { m.resize(); m.triggerRepaint(); } }, d));

    return () => {
      kicks.forEach(clearTimeout);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── grid data ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(gridFC(grid));
  }, [ready, grid]);

  // ── industry overlay ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const feats = (showIndustry && industrial)
      ? industrial.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] } }))
      : [];
    (map.getSource("industry") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: feats });
  }, [ready, industrial, showIndustry]);

  // ── basemap change ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (VECTOR) {
      map.setStyle(MAPTILER_STYLE[basemap]);
      map.once("style.load", () => { applyData(map); map.triggerRepaint(); });
    } else {
      map.setLayoutProperty("carto", "visibility", basemap === "dark" ? "visible" : "none");
      map.setLayoutProperty("voyager", "visibility", basemap === "streets" ? "visible" : "none");
      map.setLayoutProperty("esri", "visibility", basemap === "sat" ? "visible" : "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, basemap]);

  // ── 2D / 3D toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer("grid-3d")) map.setLayoutProperty("grid-3d", "visibility", is3D ? "visible" : "none");
    if (map.getLayer("grid-2d")) map.setLayoutProperty("grid-2d", "visibility", is3D ? "none" : "visible");
    if (map.getLayer("vn-buildings")) map.setLayoutProperty("vn-buildings", "visibility", is3D ? "visible" : "none");
    map.easeTo({ pitch: is3D ? 50 : 0, bearing: is3D ? -18 : 0, duration: 600 });
  }, [ready, is3D]);

  // ── zone markers (hover = scale only; click = select → side panel) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const byId = new Map(attributions.map((a) => [a.zone_id, a]));
    for (const z of city.zones) {
      const a = byId.get(z.id);
      const aqi = a?.aqi ?? 0;
      const color = aqi ? aqiColor(aqi) : "#3A3B40";
      const selected = z.id === selectedZoneId;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "vn-marker";
      el.setAttribute("aria-label", `${z.name}: AQI ${aqi || "n/a"}`);
      el.setAttribute("aria-pressed", String(selected));
      el.textContent = aqi ? String(aqi) : "–";
      // NOTE: do NOT put a `transition` on this element or set its `transform` directly —
      // MapLibre positions the marker via `transform`, so a transition makes it animate
      // ("flow") from the top-left on every re-render, and setting transform clobbers the
      // position. Hover feedback is done with box-shadow (a CSS class) instead.
      el.style.cssText =
        `appearance:none;padding:0;display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;` +
        `background:${color};color:${textOn(color)};` +
        `font:600 12px var(--font-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
        `border:2px solid ${selected ? "#F4F5F6" : "rgba(8,9,10,.72)"};` +
        `box-shadow:0 1px 3px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.35)${selected ? ",0 0 0 4px rgba(244,245,246,.22)" : ""};` +
        `cursor:pointer;`;
      if (aqi >= 401) el.classList.add("vn-pulse");
      el.onclick = (e) => { e.stopPropagation(); selectRef.current(z.id); };
      const marker = new maplibregl.Marker({ element: el }).setLngLat([z.center.lon, z.center.lat]).addTo(map);
      markersRef.current.push(marker);
    }
    deoverlap(map, markersRef.current);
  }, [ready, city, attributions, selectedZoneId]);

  // ── fit to city ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const b = city.bbox;
    map.fitBounds([[b.min_lon, b.min_lat], [b.max_lon, b.max_lat]], { padding: { top: 56, right: 64, bottom: 64, left: 56 }, maxZoom: 12, duration: 700 });
    const t = setTimeout(() => map.easeTo({ pitch: is3DRef.current ? 50 : 0, bearing: is3DRef.current ? -18 : 0, duration: 450 }), 720);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city]);

  // ── SVG fallback (zero-GPU) ────────────────────────────────────────
  if (mode === "static") {
    return (
      <StaticMap
        city={city} grid={grid} attributions={attributions}
        selectedZoneId={selectedZoneId} onSelectZone={onSelectZone}
        onTryGL={hasWebGL() ? () => setMode("gl") : undefined}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />

      {ready && mapRef.current && wind && wind.speed > 0.3 && (
        <WindLayer map={mapRef.current} dir={wind.dir} speed={wind.speed} />
      )}

      {wind && wind.speed > 0.3 && (
        <div className="glass absolute left-3 top-3 z-20 flex items-center gap-2 px-2.5 py-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" className="text-text-hi" style={{ transform: `rotate(${(wind.dir + 180) % 360}deg)` }}>
            <path d="M12 3 L12 21 M12 3 L7.5 9 M12 3 L16.5 9" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-mono text-[11px] text-text">wind from {compass(wind.dir)} · {(wind.speed * 3.6).toFixed(0)} km/h</span>
        </div>
      )}

      {tilesBlocked && (
        <div className="glass pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 px-2.5 py-1 font-mono text-[11px] text-text-mid">
          basemap tiles unavailable — showing AQI data only
        </div>
      )}

      {/* legend — small, bottom-left, click-through */}
      <div className="glass pointer-events-none absolute bottom-3 left-3 z-20 px-3 py-2">
        <div className="eyebrow mb-1">AQI · CPCB</div>
        <div className="flex overflow-hidden rounded">
          {AQI_BANDS.map((band) => (<span key={band.label} className="h-2 w-6" style={{ background: band.color }} title={band.label} />))}
        </div>
        <div className="mt-1 flex justify-between text-[8px] uppercase tracking-wide text-text-low"><span>Good</span><span>Severe</span></div>
        <div className="mt-1.5 font-mono text-[9px] text-text-low">{is3D ? "column height ∝ AQI" : "cell colour = AQI"}</div>
      </div>
    </div>
  );
}
