"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GridCell, LatLon } from "@/lib/types";
import { hasWebGL } from "@/lib/webgl";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "nc5sshnRlIfoqUGKBQkq";
const HERO_STYLE = MAPTILER_KEY ? `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}` : null;

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
    { id: "bg", type: "background", paint: { "background-color": "#08090A" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.8, "raster-saturation": -0.4, "raster-contrast": 0.05 } },
  ],
};

const EXTRUSION_COLOR: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "aqi"],
  0, "#55A84F", 50, "#8FBF4A", 100, "#C9D24A", 150, "#FFF833",
  200, "#F8C238", 250, "#F29C33", 300, "#ED6B30", 400, "#E93F33", 500, "#AF2D24",
];

function cellPolygon(lat: number, lon: number, stepKm: number) {
  const dLat = stepKm / 111 / 2;
  const dLon = stepKm / (111 * Math.cos((lat * Math.PI) / 180)) / 2;
  return [[
    [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat],
  ]];
}

function fc(cells: GridCell[], stepKm: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((c) => ({
      type: "Feature",
      properties: { aqi: c.aqi, height: Math.min(Math.max(c.aqi * 6, 40), 3000) },
      geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, stepKm) },
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

/** The product as hero: a slowly self-orbiting 3D AQI skyline; SVG fallback if WebGL is unavailable. */
export default function HeroMap({ cells, center, stepKm }: { cells: GridCell[]; center: LatLon; stepKm: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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
        pitch: 56,
        bearing: -22,
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
      if (!map.getSource("grid")) {
        map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "grid-3d", type: "fill-extrusion", source: "grid",
          paint: {
            "fill-extrusion-color": EXTRUSION_COLOR,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.6,
            "fill-extrusion-vertical-gradient": true,
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

    // slow self-orbit (~2.4°/s), guarded so a bad frame can't throw uncaught
    let raf = 0;
    let bearing = -22;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const spin = () => {
      try {
        bearing = (bearing + 0.04) % 360;
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
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(fc(cells, stepKm));
  }, [ready, cells, stepKm]);

  if (failed) return <HeroFallback cells={cells} />;
  return <div ref={containerRef} className="h-full w-full" role="img" aria-label="Live 3D AQI skyline — column height shows pollution level" />;
}
