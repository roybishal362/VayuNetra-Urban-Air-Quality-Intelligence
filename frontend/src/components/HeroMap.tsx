"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GridCell, LatLon } from "@/lib/types";

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
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.5, "raster-saturation": -0.95, "raster-contrast": 0.1 } },
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

/** The product as hero: a slowly self-orbiting 3D AQI skyline. Non-interactive. */
export default function HeroMap({ cells, center, stepKm }: { cells: GridCell[]; center: LatLon; stepKm: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [center.lon, center.lat],
      zoom: 9.7,
      pitch: 56,
      bearing: -22,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    const onReady = () => {
      if (!map.getSource("grid")) {
        map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "grid-3d",
          type: "fill-extrusion",
          source: "grid",
          paint: {
            "fill-extrusion-color": EXTRUSION_COLOR,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.85,
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

    // slow self-orbit (~2.4°/s) — paused for reduced-motion
    let raf = 0;
    let bearing = -22;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const spin = () => {
      bearing = (bearing + 0.04) % 360;
      map.setBearing(bearing);
      raf = requestAnimationFrame(spin);
    };
    if (!reduce) raf = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("grid") as maplibregl.GeoJSONSource | undefined)?.setData(fc(cells, stepKm));
  }, [ready, cells, stepKm]);

  return <div ref={containerRef} className="h-full w-full" />;
}
