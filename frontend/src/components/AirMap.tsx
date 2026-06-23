"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn, AQI_BANDS } from "@/lib/aqi";
import { hasWebGL } from "@/lib/webgl";
import StaticMap from "./StaticMap";

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
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.6, "raster-saturation": -0.9, "raster-contrast": 0.1 } },
    { id: "esri", type: "raster", source: "esri", layout: { visibility: "none" }, paint: { "raster-opacity": 0.9, "raster-saturation": -0.6, "raster-brightness-max": 0.85 } },
  ],
};

const EXTRUSION_COLOR: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "aqi"],
  0, "#55A84F", 50, "#8FBF4A", 100, "#C9D24A", 150, "#FFF833",
  200, "#F8C238", 250, "#F29C33", 300, "#ED6B30", 400, "#E93F33", 500, "#AF2D24",
];

// Read a handful of pixels from the rendered GL canvas; if nothing but the dark
// background is present where the AQI field should be, the GPU isn't drawing — fall back.
function probeBlank(map: maplibregl.Map): boolean {
  try {
    const canvas = map.getCanvas();
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return true;
    const w = canvas.width | 0, h = canvas.height | 0;
    if (!w || !h) return true;
    const buf = new Uint8Array(4);
    let bright = 0;
    for (let ix = 1; ix <= 5; ix++) {
      for (let iy = 1; iy <= 4; iy++) {
        const x = Math.floor((ix / 6) * w);
        const y = Math.floor((iy / 6) * h);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        if (buf[0] > 60 || buf[1] > 60 || buf[2] > 60) bright++;
      }
    }
    return bright === 0; // nothing brighter than the dark canvas → blank render
  } catch {
    return false; // probe failed → assume the map is fine, don't false-fallback
  }
}

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
      properties: { aqi: c.aqi, color: c.color, height: Math.min(Math.max(c.aqi * 6, 40), 3000) },
      geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, grid.step_km) },
    })),
  };
}

type Hover = { x: number; y: number; name: string; aqi: number; category: string; source: string } | null;

export default function AirMap({
  city, grid, attributions, selectedZoneId, onSelectZone, industrial, showIndustry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const probedRef = useRef(false);
  const selectRef = useRef(onSelectZone);
  selectRef.current = onSelectZone;
  const [mode, setMode] = useState<"gl" | "static">(() => (hasWebGL() ? "gl" : "static"));
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [basemap, setBasemap] = useState<"dark" | "sat">("dark");
  const [hover, setHover] = useState<Hover>(null);
  const [tilesBlocked, setTilesBlocked] = useState(false);

  // ── init (only in GL mode) ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== "gl" || !containerRef.current || mapRef.current) return;
    if (!hasWebGL()) { setMode("static"); return; }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE,
        center: [city.center.lon, city.center.lat],
        zoom: 10,
        pitch: 50,
        bearing: -18,
        maxPitch: 70,
        attributionControl: false,
        preserveDrawingBuffer: true, // lets us probe whether anything actually rendered
      });
    } catch {
      setMode("static");
      return;
    }
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

    const onReady = () => {
      if (!map.getSource("grid")) {
        map.addSource("grid", { type: "geojson", data: gridFC(null) });
        map.addLayer({
          id: "grid-2d", type: "fill", source: "grid", layout: { visibility: "none" },
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.5, "fill-outline-color": "rgba(255,255,255,0.1)" },
        });
        map.addLayer({
          id: "grid-3d", type: "fill-extrusion", source: "grid",
          paint: {
            "fill-extrusion-color": EXTRUSION_COLOR,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.85,
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
      map.resize();
      setReady(true);
    };
    map.on("load", onReady);
    map.once("idle", onReady);
    map.on("movestart", () => setHover(null));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
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

  // ── blank-render probe → auto fall back to the SVG map ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== "gl" || !ready || !map || probedRef.current) return;
    if (!grid || !grid.cells.length) return;
    const t = setTimeout(() => {
      probedRef.current = true;
      if (probeBlank(map)) setMode("static");
    }, 1900);
    return () => clearTimeout(t);
  }, [mode, ready, grid]);

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

  // ── basemap toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("carto", "visibility", basemap === "dark" ? "visible" : "none");
    map.setLayoutProperty("esri", "visibility", basemap === "sat" ? "visible" : "none");
    map.setPaintProperty("grid-3d", "fill-extrusion-opacity", basemap === "sat" ? 0.72 : 0.85);
  }, [ready, basemap]);

  // ── 2D / 3D toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("grid-3d", "visibility", is3D ? "visible" : "none");
    map.setLayoutProperty("grid-2d", "visibility", is3D ? "none" : "visible");
    map.easeTo({ pitch: is3D ? 50 : 0, bearing: is3D ? -18 : 0, duration: 600 });
  }, [ready, is3D]);

  // ── markers ─────────────────────────────────────────────────────────
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
      el.style.cssText =
        `appearance:none;padding:0;display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;` +
        `background:${color};color:${textOn(color)};` +
        `font:600 12px var(--font-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
        `border:2px solid ${selected ? "#F4F5F6" : "rgba(8,9,10,.72)"};` +
        `box-shadow:0 1px 3px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.35)${selected ? ",0 0 0 4px rgba(244,245,246,.22)" : ""};` +
        `cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;z-index:${selected ? 3 : 1};`;
      if (aqi >= 401) el.classList.add("vn-pulse");
      el.onmouseenter = () => {
        el.style.transform = "scale(1.18)";
        const pt = map.project([z.center.lon, z.center.lat]);
        const W = containerRef.current?.clientWidth ?? 0;
        const H = containerRef.current?.clientHeight ?? 0;
        setHover({ x: Math.max(10, Math.min(pt.x + 16, W - 196)), y: Math.max(10, Math.min(pt.y - 10, H - 96)),
          name: z.name, aqi, category: a?.category ?? "—", source: a?.contributions?.[0]?.label ?? "" });
      };
      el.onmouseleave = () => { el.style.transform = "scale(1)"; setHover(null); };
      el.onclick = (e) => { e.stopPropagation(); setHover(null); selectRef.current(z.id); };
      const marker = new maplibregl.Marker({ element: el }).setLngLat([z.center.lon, z.center.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, city, attributions, selectedZoneId]);

  // ── fit to city ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const b = city.bbox;
    map.fitBounds([[b.min_lon, b.min_lat], [b.max_lon, b.max_lat]], { padding: { top: 56, right: 64, bottom: 64, left: 56 }, maxZoom: 12, duration: 700 });
    const t = setTimeout(() => map.easeTo({ pitch: is3D ? 50 : 0, bearing: is3D ? -18 : 0, duration: 450 }), 720);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city]);

  // ── SVG fallback (zero-GPU) ────────────────────────────────────────
  if (mode === "static") {
    return (
      <StaticMap
        city={city}
        grid={grid}
        attributions={attributions}
        selectedZoneId={selectedZoneId}
        onSelectZone={onSelectZone}
        onTryGL={hasWebGL() ? () => { probedRef.current = true; setMode("gl"); } : undefined}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {tilesBlocked && (
        <div className="glass pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 px-2.5 py-1 font-mono text-[11px] text-text-mid">
          basemap tiles unavailable — showing AQI data only
        </div>
      )}

      {hover && (
        <div className="glass pointer-events-none absolute z-20 w-[186px] px-3 py-2" style={{ left: hover.x, top: hover.y }}>
          <div className="truncate text-[13px] font-semibold text-text-hi">{hover.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums"
                  style={{ background: aqiColor(hover.aqi), color: textOn(aqiColor(hover.aqi)) }}>
              {hover.aqi || "—"}
            </span>
            <span className="text-[11px] text-text-mid">{hover.category}</span>
          </div>
          {hover.source && <div className="mt-1 truncate text-[11px] text-text-low">{hover.source}</div>}
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="glass flex items-center gap-0.5 p-1">
          {(["dark", "sat"] as const).map((bm) => (
            <button key={bm} onClick={() => setBasemap(bm)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-fast ${basemap === bm ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi"}`}>
              {bm === "dark" ? "Dark" : "Satellite"}
            </button>
          ))}
        </div>
        <div className="glass flex items-center gap-0.5 p-1">
          {([true, false] as const).map((v) => (
            <button key={String(v)} onClick={() => setIs3D(v)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-fast ${is3D === v ? "bg-white/[0.1] text-text-hi" : "text-text-mid hover:text-text-hi"}`}>
              {v ? "3D" : "2D"}
            </button>
          ))}
          <button onClick={() => { probedRef.current = true; setMode("static"); }}
            title="Switch to the no-GPU schematic map"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-text-mid transition-colors duration-fast hover:text-text-hi">
            Flat
          </button>
        </div>
      </div>

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
