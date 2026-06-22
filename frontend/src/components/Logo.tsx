export default function Logo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}
         role="img" aria-label="VayuNetra logo">
      <defs>
        <linearGradient id="vn-grad" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id="vn-pupil" cx="0.5" cy="0.45" r="0.6">
          <stop stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#0ea5e9" />
        </radialGradient>
      </defs>
      {/* eye = lens of airflow */}
      <path d="M2.5 16 C8 9, 24 9, 29.5 16 C24 23, 8 23, 2.5 16 Z"
            stroke="url(#vn-grad)" strokeWidth="2" strokeLinejoin="round" fill="none" />
      {/* iris */}
      <circle cx="16" cy="16" r="5.2" stroke="url(#vn-grad)" strokeWidth="1.5" fill="none" />
      {/* sensor / pupil */}
      <circle cx="16" cy="16" r="2.4" fill="url(#vn-pupil)" />
      {/* wind currents */}
      <path d="M5 6.6 L12 6.6" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <path d="M20 25.6 L27 25.6" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
