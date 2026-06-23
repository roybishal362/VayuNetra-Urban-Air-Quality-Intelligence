"use client";

import clsx from "clsx";

export interface TimeValue { layer: "current" | "forecast"; horizon: number }

const OPTIONS: { label: string; value: TimeValue }[] = [
  { label: "Now", value: { layer: "current", horizon: 0 } },
  { label: "+24h", value: { layer: "forecast", horizon: 24 } },
  { label: "+48h", value: { layer: "forecast", horizon: 48 } },
  { label: "+72h", value: { layer: "forecast", horizon: 72 } },
];

export default function TimeControl({
  value,
  onChange,
}: {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}) {
  return (
    <div className="card flex items-center gap-1 p-1">
      {OPTIONS.map((o) => {
        const active = o.value.layer === value.layer && o.value.horizon === value.horizon;
        return (
          <button
            key={o.label}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-text-hi text-vn-base"
                : "text-text hover:bg-white/[0.06] hover:text-text-hi",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
