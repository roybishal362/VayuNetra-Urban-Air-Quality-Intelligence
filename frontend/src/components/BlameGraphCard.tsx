"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BlameGraph } from "@/lib/types";
import { aqiColor } from "@/lib/aqi";

export default function BlameGraphCard({ cityId }: { cityId: string }) {
  const [d, setD] = useState<BlameGraph | null>(null);

  useEffect(() => {
    let c = false;
    setD(null);
    api.blameGraph(cityId).then((x) => !c && setD(x)).catch(() => {});
    return () => { c = true; };
  }, [cityId]);

  if (!d || d.nodes.length < 2) return null;

  const W = 380, H = 280, pad = 30;
  const lats = d.nodes.map((n) => n.lat), lons = d.nodes.map((n) => n.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const sx = (lon: number) => pad + (maxLon > minLon ? (lon - minLon) / (maxLon - minLon) : 0.5) * (W - 2 * pad);
  const sy = (lat: number) => pad + (maxLat > minLat ? (maxLat - lat) / (maxLat - minLat) : 0.5) * (H - 2 * pad);
  const pos: Record<string, { x: number; y: number; aqi: number; name: string }> = {};
  for (const n of d.nodes) pos[n.zone_id] = { x: sx(n.lon), y: sy(n.lat), aqi: n.aqi, name: n.zone_name };

  return (
    <div className="card p-3">
      <div className="eyebrow mb-1">Pollution blame-graph · who pollutes whom</div>
      <p className="mb-1 text-[11px] leading-relaxed text-text-low">
        Arrows follow the wind — a ward sends its plume downwind onto its neighbours.
        {d.wind_from != null ? ` Wind from ${d.wind_from}°.` : ""}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <marker id="bg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="rgba(233,63,51,0.85)" />
          </marker>
        </defs>
        {d.edges.map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          // shorten the line so the arrowhead sits at the node edge, not under it
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          return (
            <line key={i} x1={a.x + ux * 10} y1={a.y + uy * 10} x2={b.x - ux * 11} y2={b.y - uy * 11}
              stroke="rgba(233,63,51,0.5)" strokeWidth={1 + e.weight * 3.5} markerEnd="url(#bg-arrow)" />
          );
        })}
        {d.nodes.map((n) => {
          const p = pos[n.zone_id];
          return (
            <g key={n.zone_id}>
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="7.5" fill="#9aa0aa">{n.zone_name.split(" ")[0]}</text>
              <circle cx={p.x} cy={p.y} r={9} fill={aqiColor(n.aqi)} stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} />
              <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#0b0c0e" fontFamily="monospace">{n.aqi}</text>
            </g>
          );
        })}
      </svg>
      <div className="font-mono text-[9px] text-text-low">node = ward (AQI) · arrow = downwind transport · thicker = stronger</div>
    </div>
  );
}
