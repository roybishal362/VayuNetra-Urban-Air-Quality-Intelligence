/**
 * Branded loading splash shown on the first full page load.
 * Pure CSS auto-fade (so it works even before hydration, and respects reduced-motion,
 * which collapses the animation to ~instant). It stays in the DOM but becomes hidden +
 * non-interactive after the fade; client-side navigations don't replay it.
 */
export default function Splash() {
  return (
    <div className="vn-splash fixed inset-0 z-[200] grid place-items-center bg-vn-base" aria-hidden>
      <div className="flex flex-col items-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lockup.png" alt="VayuNetra" className="w-[340px] max-w-[82vw] select-none" />
        <div className="mt-1 h-0.5 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="vn-splash-bar h-full w-1/3 rounded-full bg-white/55" />
        </div>
      </div>
    </div>
  );
}
