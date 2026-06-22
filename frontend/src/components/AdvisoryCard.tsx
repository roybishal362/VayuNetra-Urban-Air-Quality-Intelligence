"use client";

import { useState } from "react";
import clsx from "clsx";
import type { AdvisoryItem } from "@/lib/types";

const LANG_LABEL: Record<string, string> = {
  en: "English", hi: "हिंदी", kn: "ಕನ್ನಡ", ta: "தமிழ்", pa: "ਪੰਜਾਬੀ",
  ur: "اردو", te: "తెలుగు", mr: "मराठी", bn: "বাংলা",
};
const RISK_COLOR: Record<string, string> = {
  Low: "#55A84F", Moderate: "#FFF833", High: "#F29C33", Severe: "#E93F33",
};

export default function AdvisoryCard({ advisory }: { advisory: AdvisoryItem }) {
  const langs = Object.keys(advisory.languages);
  const [lang, setLang] = useState(langs[0] ?? "en");
  const active = advisory.languages[lang] ? lang : langs[0];
  const riskColor = RISK_COLOR[advisory.risk_level] ?? "#94a3b8";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="chip"
          style={{ background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}55` }}
        >
          {advisory.risk_level} risk · peak AQI {advisory.peak_aqi}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {advisory.generated_by === "llm" ? "AI-generated" : "template"}
        </span>
      </div>

      <div className="font-medium text-slate-200">{advisory.headline}</div>
      <ul className="space-y-1">
        {advisory.guidance.map((g, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-300">
            <span className="text-brand">•</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
      <div className="text-xs text-slate-500">{advisory.vulnerable_note}</div>

      {langs.length > 0 && (
        <div className="rounded-lg border border-ink-700 bg-ink-850/60 p-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={clsx(
                  "rounded px-2 py-0.5 text-xs",
                  l === active ? "bg-brand text-ink-950" : "bg-ink-700 text-slate-300 hover:bg-ink-600",
                )}
              >
                {LANG_LABEL[l] ?? l.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-slate-200" dir={active === "ur" ? "rtl" : "ltr"}>
            {advisory.languages[active]}
          </p>
        </div>
      )}
    </div>
  );
}
