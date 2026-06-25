"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, TrendingUp, LineChart, ShieldAlert, FlaskConical, BarChart3, Languages, Info, HeartPulse,
} from "lucide-react";
import Logo from "./Logo";

const ITEMS = [
  { href: "/console", icon: LayoutDashboard, label: "Command Center" },
  { href: "/forecast", icon: TrendingUp, label: "Forecast" },
  { href: "/trends", icon: LineChart, label: "Trends" },
  { href: "/enforcement", icon: ShieldAlert, label: "Enforcement" },
  { href: "/validation", icon: FlaskConical, label: "Validation" },
  { href: "/compare", icon: BarChart3, label: "National Compare" },
  { href: "/advisories", icon: Languages, label: "Advisories" },
  { href: "/health", icon: HeartPulse, label: "Exposure & Health" },
  { href: "/about", icon: Info, label: "About" },
];

export default function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="flex w-14 flex-shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-white/[0.06] bg-vn-900/80 py-3 backdrop-blur-xl sm:w-16 print:hidden">
      <Link
        href="/"
        aria-label="VayuNetra — back to home"
        title="Back to landing page"
        className="group relative mb-2 grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-vn-850 text-text-hi transition-colors hover:border-white/20"
      >
        <Logo size={30} />
        <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-md border border-white/10 bg-vn-800 px-2 py-1 text-xs text-text shadow-xl group-hover:block">
          Home / landing
        </span>
      </Link>
      {ITEMS.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-label={it.label}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group relative grid h-11 w-11 place-items-center rounded-xl transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active ? "bg-white/[0.07] text-text-hi" : "text-text-low hover:bg-white/[0.05] hover:text-text",
            )}
          >
            <Icon size={18} strokeWidth={1.6} />
            {active && <span className="absolute left-0 h-6 w-0.5 rounded-r bg-text-hi" />}
            <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-md border border-white/10 bg-vn-800 px-2 py-1 text-xs text-text shadow-xl group-hover:block group-focus-visible:block">
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
