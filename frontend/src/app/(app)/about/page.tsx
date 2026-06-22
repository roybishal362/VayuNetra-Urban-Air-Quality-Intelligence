function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-brand">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-100">VayuNetra — methodology & honesty</h1>
          <p className="mt-1 text-sm text-slate-400">
            An urban air-quality intelligence platform: <span className="text-slate-200">Monitor → Predict → Attribute → Act</span>, across 6 Indian metros.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="What it does">
            <p>Turns 900+ monitoring stations from a dashboard you watch into a system that <b className="text-slate-100">predicts</b> ward-level PM2.5, <b className="text-slate-100">attributes</b> it to real sources, <b className="text-slate-100">prioritises</b> enforcement, and <b className="text-slate-100">advises</b> citizens in their own language.</p>
          </Section>
          <Section title="Data (real, mostly keyless)">
            <ul className="list-inside list-disc space-y-1">
              <li>Open-Meteo CAMS — PM2.5/PM10/NO₂/SO₂/O₃/CO + weather (incl. boundary-layer height)</li>
              <li>NASA FIRMS — active fires (seasonal/regional model when offline)</li>
              <li>OpenStreetMap — industrial areas + major roads (land-use regression)</li>
              <li>Committed offline snapshots so the demo never needs the network</li>
            </ul>
          </Section>
          <Section title="Forecasting">
            <p>Pooled gradient boosting (PM2.5 lags + the weather forecast at target time + cyclic temporal + location), <b className="text-slate-100">blended with a diurnal-persistence baseline</b> at a weight tuned on held-out data — so it never underperforms the baseline.</p>
            <p className="text-slate-400">Validated on a temporal hold-out: RMSE skill, correlation, bias, and conformal p10–p90 calibration. See the Validation page.</p>
          </Section>
          <Section title="Source attribution">
            <p>Fuses four independent signals: chemistry fingerprint (NO₂/CO/SO₂), PM10:PM2.5 coarse ratio, upwind FIRMS fires (wind back-trajectory), and meteorological dispersion — plus OSM land-use. Confidence-scored, with an evidence chain.</p>
            <p className="text-slate-400">A calibrated rule-based fingerprint, <b>not</b> a chemical-transport model — stated honestly.</p>
          </Section>
          <Section title="Honesty">
            <ul className="list-inside list-disc space-y-1">
              <li>Fire data is flagged when modeled (no live FIRMS key)</li>
              <li>Crop-burning is seasonal/regional — coastal metros show ~none</li>
              <li>Metrics are reported on a clean hold-out, no cherry-picking</li>
              <li>Hyperlocal downscaling is stated as an estimate, not a measurement</li>
            </ul>
          </Section>
          <Section title="Tech stack">
            <ul className="list-inside list-disc space-y-1">
              <li>Backend: FastAPI · scikit-learn · pandas · httpx</li>
              <li>Frontend: Next.js · TypeScript · MapLibre · Recharts · Tailwind</li>
              <li>LLM: Groq (OpenAI-compatible) for advisories + briefings; template fallback</li>
              <li>Runs locally or in GitHub Codespaces</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
