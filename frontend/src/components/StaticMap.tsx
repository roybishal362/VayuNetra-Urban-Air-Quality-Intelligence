"use client";

import { useMemo, useState } from "react";
import type { City, GridResponse, ZoneAttribution } from "@/lib/types";
import { aqiColor, textOn, AQI_BANDS } from "@/lib/aqi";

/**
 * Zero-GPU fallback map — a pure SVG choropleth of the AQI grid + clickable wards.
 * Used when WebGL is unavailable or the GL canvas paints blank (locked-down laptops,
 * blocked drivers). No tiles, no WebGL: it renders anywhere a browser can draw SVG.
 */
export default function StaticMap({
  city, grid, attributions, selectedZoneId, onSelectZone, onTryGL,
}: {
  city: City;
  grid: GridResponse | null;
  attributions: ZoneAttribution[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  onTryGL?: () => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const b = city.bbox;
  const W = 1000;
  const midLat = (b.min_lat + b.max_lat) / 2;
  const lonSpan = Math.max(1e-4, b.max_lon - b.min_lon);
  const latSpan = Math.max(1e-4, b.max_lat - b.min_lat);
  // keep geographic aspect ratio (lon degrees shrink with latitude)
  const H = Math.round((W * latSpan) / (lonSpan * Math.cos((midLat * Math.PI) / 180)));

  const px = (lon: number) => ((lon - b.min_lon) / lonSpan) * W;
  const py = (lat: number) => ((b.max_lat - lat) / latSpan) * H;

  const cellPx = useMemo(() => {
    if (!grid || !grid.cells.length) return 18;
    const dLon = grid.step_km / (111 * Math.cos((midLat * Math.PI) / 180));
    return Math.max(8, (dLon / lonSpan) * W * 0.96);
  }, [grid, lonSpan, midLat]);

  const byId = useMemo(() => new Map(attributions.map((a) => [a.zone_id, a])), [attributions]);
  const hovered = hoverId ? byId.get(hoverId) : undefined;
  const hoveredZone = hoverId ? city.zones.find((z) => z.id === hoverId) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-vn-base">
      {/* faint dotted developer-canvas texture */}
      <div className="pointer-events-none absolute inset-0 opacity-50"
           style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)", backgroundSize: "22px 22px" }} />

      <svg viewBox={`-40 -40 ${W + 80} ${H + 80}`} className="absolute inset-0 h-full w-full"
           preserveAspectRatio="xMidYMid meet">
        {/* AQI grid choropleth */}
        {grid?.cells.map((c, i) => (
          <rect
            key={i}
            x={px(c.lon) - cellPx / 2}
            y={py(c.lat) - cellPx / 2}
            width={cellPx}
            height={cellPx}
            rx={2}
            fill={c.color}
            fillOpacity={0.55}
          />
        ))}

        {/* ward markers */}
        {city.zones.map((z) => {
          const a = byId.get(z.id);
          const aqi = a?.aqi ?? 0;
          const color = aqi ? aqiColor(aqi) : "#3A3B40";
          const selected = z.id === selectedZoneId;
          return (
            <g
              key={z.id}
              transform={`translate(${px(z.center.lon)} ${py(z.center.lat)})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectZone(z.id)}
              onMouseEnter={() => setHoverId(z.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <circle r={selected ? 17 : 14} fill={color} fillOpacity={0.95}
                      stroke={selected ? "#F4F5F6" : "rgba(8,9,10,0.7)"} strokeWidth={selected ? 3 : 2} />
              <text textAnchor="middle" dy="4.5" fontSize="13" fontWeight="600"
                    fontFamily="var(--font-mono), monospace" fill={textOn(color)}>
                {aqi || "–"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* hover readout */}
      {hovered && hoveredZone && (
        <div className="glass pointer-events-none absolute left-3 top-3 z-20 w-[200px] px-3 py-2">
          <div className="truncate text-[13px] font-semibold text-text-hi">{hoveredZone.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums"
                  style={{ background: aqiColor(hovered.aqi), color: textOn(aqiColor(hovered.aqi)) }}>
              {hovered.aqi || "—"}
            </span>
            <span className="text-[11px] text-text-mid">{hovered.category}</span>
          </div>
          {hovered.contributions?.[0] && (
            <div className="mt-1 truncate text-[11px] text-text-low">{hovered.contributions[0].label}</div>
          )}
        </div>
      )}

      {/* mode note + optional retry */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        {onTryGL && (
          <button onClick={onTryGL} className="btn-ghost px-2.5 py-1 text-[11px]">Try 3D map</button>
        )}
        <div className="glass px-2.5 py-1 font-mono text-[10px] text-text-mid">schematic · no-GPU mode</div>
      </div>

      {/* legend */}
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
      </div>
    </div>
  );
}
