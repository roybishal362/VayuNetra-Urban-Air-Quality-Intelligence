"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn, AQI_BANDS } from "@/lib/aqi";

// Two free, keyless raster basemaps, both muted so the AQI field owns all colour.
// We pre-add both and toggle visibility (no source swap → no reflow).
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
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#08090A" } },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: { "raster-opacity": 0.55, "raster-saturation": -0.9, "raster-contrast": 0.1 },
    },
    {
      id: "esri",
      type: "raster",
      source: "esri",
      layout: { visibility: "none" },
      paint: { "raster-opacity": 0.9, "raster-saturation": -0.6, "raster-brightness-max": 0.85 },
    },
  ],
};

// Continuous AQI ramp for the 3D field (smoother than the 6 discrete CPCB swatches).
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
      properties: {
        aqi: c.aqi,
        color: c.color,
        // AQI → tower height in metres: Severe (≈450) ≈ 2.7 km, Good cells stay low slabs.
        height: Math.min(Math.max(c.aqi * 6, 40), 3000),
      },
      geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, grid.step_km) },
    })),
  };
}

type Hover = { x: number; y: number; name: string; aqi: number; category: string; source: string } | null;

export default function AirMap({
  city, grid, attributions, selectedZoneId, onSelectZone, industrial, showIndustry,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const selectRef = useRef(onSelectZone);
  selectRef.current = onSelectZone;
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [basemap, setBasemap] = useState<"dark" | "sat">("dark");
  const [hover, setHover] = useState<Hover>(null);

  // ── init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [city.center.lon, city.center.lat],
      zoom: 10,
      pitch: 52,
      bearing: -18,
      maxPitch: 70,
      antialias: true,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    const onReady = () => {
      if (!map.getSource("grid")) {
        map.addSource("grid", { type: "geojson", data: gridFC(null) });
        map.addLayer({
          id: "grid-3d",
          type: "fill-extrusion",
          source: "grid",
          paint: {
            "fill-extrusion-color": EXTRUSION_COLOR,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.82,
            "fill-extrusion-vertical-gradient": true,
          },
        });
      }
      if (!map.getSource("industry")) {
        map.addSource("industry", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "industry",
          type: "circle",
          source: "industry",
          paint: {
            "circle-radius": 3.2, "circle-color": "#E67E22", "circle-opacity": 0.9,
            "circle-stroke-width": 0.5, "circle-stroke-color": "#7c3a0f",
          },
        });
      }
      // ambience — feature-detect (older MapLibre builds lack these)
      try {
        (map as unknown as { setSky?: (s: object) => void }).setSky?.({
          "sky-color": "#0B0C0E", "horizon-color": "#161719", "fog-color": "#08090A",
        });
      } catch { /* noop */ }
      try {
        map.setLight?.({ anchor: "viewport", color: "#ffffff", intensity: 0.4, position: [1.3, 90, 35] });
      } catch { /* noop */ }
      map.resize();
      setReady(true);
    };
    map.on("load", onReady);
    map.once("idle", onReady); // backstop if 'load' is missed under StrictMode double-mount
    map.on("movestart", () => setHover(null));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      ? industrial.map((p) => ({
          type: "Feature" as const, properties: {},
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        }))
      : [];
    (map.getSource("industry") as maplibregl.GeoJSONSource | undefined)
      ?.setData({ type: "FeatureCollection", features: feats });
  }, [ready, industrial, showIndustry]);

  // ── basemap toggle (visibility only) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("carto", "visibility", basemap === "dark" ? "visible" : "none");
    map.setLayoutProperty("esri", "visibility", basemap === "sat" ? "visible" : "none");
    map.setPaintProperty("grid-3d", "fill-extrusion-opacity", basemap === "sat" ? 0.72 : 0.82);
  }, [ready, basemap]);

  // ── 2D / 3D toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.easeTo({ pitch: is3D ? 52 : 0, bearing: is3D ? -18 : 0, duration: 600 });
  }, [ready, is3D]);

  // ── zone markers (HTML — always render above the canvas, never occluded) ──
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
      const el = document.createElement("div");
      el.className = "vn-marker";
      el.textContent = aqi ? String(aqi) : "–";
      el.style.cssText =
        `display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;` +
        `background:${color};color:${textOn(color)};` +
        `font:600 12px var(--font-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
        `border:2px solid ${selected ? "#F4F5F6" : "rgba(8,9,10,.72)"};` +
        `box-shadow:0 1px 3px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.35)` +
        `${selected ? ",0 0 0 4px rgba(244,245,246,.22)" : ""};` +
        `cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;z-index:${selected ? 3 : 1};`;
      if (aqi >= 401) el.classList.add("vn-pulse");

      el.onmouseenter = () => {
        el.style.transform = "scale(1.18)";
        const pt = map.project([z.center.lon, z.center.lat]);
        const W = containerRef.current?.clientWidth ?? 0;
        const H = containerRef.current?.clientHeight ?? 0;
        setHover({
          x: Math.max(10, Math.min(pt.x + 16, W - 196)),
          y: Math.max(10, Math.min(pt.y - 10, H - 96)),
          name: z.name,
          aqi,
          category: a?.category ?? "—",
          source: a?.contributions?.[0]?.label ?? "",
        });
      };
      el.onmouseleave = () => { el.style.transform = "scale(1)"; setHover(null); };
      el.onclick = (e) => { e.stopPropagation(); setHover(null); selectRef.current(z.id); };

      const marker = new maplibregl.Marker({ element: el }).setLngLat([z.center.lon, z.center.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, city, attributions, selectedZoneId]);

  // ── fit to city on change ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const b = city.bbox;
    map.fitBounds([[b.min_lon, b.min_lat], [b.max_lon, b.max_lat]], {
      padding: { top: 56, right: 64, bottom: 64, left: 56 },
      maxZoom: 12,
      duration: 700,
    });
    // pitch/bearing aren't fitBounds options — restore the 3D framing after the fit
    const t = setTimeout(() => map.easeTo({ pitch: is3D ? 52 : 0, bearing: is3D ? -18 : 0, duration: 450 }), 720);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* hover readout — lives inside the map box, clamped, so it can never reach the side panel */}
      {hover && (
        <div
          className="glass pointer-events-none absolute z-20 w-[186px] px-3 py-2"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="truncate text-[13px] font-semibold text-text-hi">{hover.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums"
              style={{ background: aqiColor(hover.aqi), color: textOn(aqiColor(hover.aqi)) }}
            >
              {hover.aqi || "—"}
            </span>
            <span className="text-[11px] text-text-mid">{hover.category}</span>
          </div>
          {hover.source && <div className="mt-1 truncate text-[11px] text-text-low">{hover.source}</div>}
        </div>
      )}

      {/* basemap + dimension toggles — bottom-right (clear of TimeControl / nav control) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="glass flex items-center gap-0.5 p-1">
          {(["dark", "sat"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-fast ${
                basemap === b ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi"
              }`}
            >
              {b === "dark" ? "Dark" : "Satellite"}
            </button>
          ))}
        </div>
        <div className="glass flex items-center gap-0.5 p-1">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              onClick={() => setIs3D(v)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-fast ${
                is3D === v ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi"
              }`}
            >
              {v ? "3D" : "2D"}
            </button>
          ))}
        </div>
      </div>

      {/* legend — bottom-left, decodes both colour and column height */}
      <div className="glass pointer-events-none absolute bottom-3 left-3 z-20 px-3 py-2">
        <div className="eyebrow mb-1">AQI · CPCB</div>
        <div className="flex overflow-hidden rounded">
          {AQI_BANDS.map((band) => (
            <span key={band.label} className="h-2 w-6" style={{ background: band.color }} title={band.label} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[8px] uppercase tracking-wide text-text-low">
          <span>Good</span>
          <span>Severe</span>
        </div>
        <div className="mt-1.5 font-mono text-[9px] text-text-low">column height ∝ AQI</div>
      </div>
    </div>
  );
}
