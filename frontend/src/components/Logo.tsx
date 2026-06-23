/**
 * VayuNetra mark — "the eye on the air".
 * An almond lens (Netra / eye) that is simultaneously the airflow it watches:
 * two streamlines sweep across the gaze (Vayu / wind). Monochrome by default
 * (inherits currentColor); `accent` paints the pupil with the AQI gradient —
 * the single place colour is allowed back into the brand.
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
          {/* wind sweeping across the gaze — recede at favicon scale */}
          <path d="M3.4 12.6c4.8-1.8 8.2-2.1 10.8-1.1" opacity="0.45" />
          <path d="M28.6 19.4c-4.8 1.8-8.2 2.1-10.8 1.1" opacity="0.45" />
        </>
      )}
      {/* almond lens = eye = aperture */}
      <path d="M5.5 16c4-5.4 8-7.6 10.5-7.6s6.5 2.2 10.5 7.6" />
      <path d="M5.5 16c4 5.4 8 7.6 10.5 7.6s6.5-2.2 10.5-7.6" />
      {/* pupil / sensor (optically centred slightly low in the lens) */}
      <circle cx="16" cy="16.3" r="2.2" fill={accent ? "url(#vn-aqi-pupil)" : "currentColor"} stroke="none" />
    </svg>
  );
}
