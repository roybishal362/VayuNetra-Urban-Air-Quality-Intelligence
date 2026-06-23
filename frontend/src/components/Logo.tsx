"use client";

import { useEffect, useState } from "react";

/**
 * VayuNetra mark.
 * If you drop a custom logo at `frontend/public/brand/logo.png` it is used everywhere
 * automatically (a transparent PNG works best). Until then this falls back to the
 * built-in almond-eye SVG ("the eye on the air"): an almond lens that is at once the
 * eye (Netra) and the airflow it watches (Vayu). Monochrome by default; `accent`
 * paints the pupil with the AQI gradient.
 */
export default function Logo({
  size = 28,
  className = "",
  accent = false,
  streamlines = true,
}: {
  size?: number;
  className?: string;
  accent?: boolean;
  streamlines?: boolean;
}) {
  const [customOk, setCustomOk] = useState(false);

  useEffect(() => {
    let alive = true;
    const im = new window.Image();
    im.onload = () => { if (alive && im.naturalWidth > 0) setCustomOk(true); };
    im.onerror = () => { if (alive) setCustomOk(false); };
    im.src = "/brand/logo.png";
    return () => { alive = false; };
  }, []);

  if (customOk) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src="/brand/logo.png"
        alt="VayuNetra"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="VayuNetra"
      className={className}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {accent && (
        <defs>
          <linearGradient id="vn-aqi-pupil" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#55A84F" />
            <stop offset="0.5" stopColor="#FFF833" />
            <stop offset="1" stopColor="#E93F33" />
          </linearGradient>
        </defs>
      )}
      {streamlines && (
        <>
          <path d="M3.4 12.6c4.8-1.8 8.2-2.1 10.8-1.1" opacity="0.45" />
          <path d="M28.6 19.4c-4.8 1.8-8.2 2.1-10.8 1.1" opacity="0.45" />
        </>
      )}
      <path d="M5.5 16c4-5.4 8-7.6 10.5-7.6s6.5 2.2 10.5 7.6" />
      <path d="M5.5 16c4 5.4 8 7.6 10.5 7.6s6.5-2.2 10.5-7.6" />
      <circle cx="16" cy="16.3" r="2.2" fill={accent ? "url(#vn-aqi-pupil)" : "currentColor"} stroke="none" />
    </svg>
  );
}
