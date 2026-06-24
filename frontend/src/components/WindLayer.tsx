"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";

/**
 * Animated wind-particle overlay (the "windy.com" effect). Pure 2D canvas sitting ON TOP
 * of the map — it never touches MapLibre layers, so it cannot break the map. Particles
 * drift in the real wind direction (computed in screen space so it's correct under the
 * map's pitch/bearing). Transparent trails via `destination-out` so it never darkens the map.
 */
export default function WindLayer({ map, dir, speed }: { map: maplibregl.Map; dir: number; speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, hgt = 0;
    let vx = 1, vy = 0;

    const computeWind = () => {
      try {
        const toRad = (((dir + 180) % 360) * Math.PI) / 180; // wind blows TO = (from + 180)
        const c = map.getCenter();
        const off = 0.05;
        const lat2 = c.lat + off * Math.cos(toRad);
        const lon2 = c.lng + (off * Math.sin(toRad)) / Math.cos((c.lat * Math.PI) / 180);
        const p0 = map.project([c.lng, c.lat]);
        const p1 = map.project([lon2, lat2]);
        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const d = Math.hypot(dx, dy) || 1;
        vx = dx / d; vy = dy / d;
      } catch { /* projection not ready */ }
    };

    const resize = () => {
      const r = map.getCanvas().getBoundingClientRect();
      w = canvas.width = Math.max(1, Math.floor(r.width));
      hgt = canvas.height = Math.max(1, Math.floor(r.height));
    };

    type P = { x: number; y: number; px: number; py: number; age: number };
    const N = 300;
    const particles: P[] = [];
    const spawn = (p: P) => { p.x = Math.random() * w; p.y = Math.random() * hgt; p.px = p.x; p.py = p.y; p.age = Math.random() * 120; };

    resize();
    computeWind();
    for (let i = 0; i < N; i++) { const p = { x: 0, y: 0, px: 0, py: 0, age: 0 }; spawn(p); particles.push(p); }
    const spd = Math.min(3.4, 0.6 + speed * 0.34);

    const frame = () => {
      // fade existing trails toward TRANSPARENT (not dark) so the map shows through
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillRect(0, 0, w, hgt);
      // draw new segments
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(190,218,248,0.72)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const p of particles) {
        p.px = p.x; p.py = p.y;
        p.x += vx * spd; p.y += vy * spd;
        p.age++;
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > hgt || p.age > 150) { spawn(p); continue; }
        ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(frame);
    };

    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) raf = requestAnimationFrame(frame);

    map.on("move", computeWind);
    const ro = new ResizeObserver(resize);
    ro.observe(map.getCanvas());

    return () => {
      cancelAnimationFrame(raf);
      map.off("move", computeWind);
      ro.disconnect();
    };
  }, [map, dir, speed]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[4]" />;
}
