import { AQI_BANDS } from "@/lib/aqi";

export default function Legend() {
  return (
    <div className="card px-3 py-2 pointer-events-none">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">
        National AQI (CPCB)
      </div>
      <div className="flex items-stretch gap-0 overflow-hidden rounded">
        {AQI_BANDS.map((b) => (
          <div key={b.label} className="flex flex-col items-center">
            <span className="h-2.5 w-12" style={{ background: b.color }} />
            <span className="mt-0.5 text-[9px] leading-tight text-slate-400">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
