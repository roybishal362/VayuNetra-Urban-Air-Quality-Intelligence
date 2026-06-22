"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, TrendingUp, ShieldAlert, FlaskConical, BarChart3, Languages, Info,
} from "lucide-react";
import Logo from "./Logo";

const ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Command Center" },
  { href: "/forecast", icon: TrendingUp, label: "Forecast" },
  { href: "/enforcement", icon: ShieldAlert, label: "Enforcement" },
  { href: "/validation", icon: FlaskConical, label: "Validation" },
  { href: "/compare", icon: BarChart3, label: "National Compare" },
  { href: "/advisories", icon: Languages, label: "Advisories" },
  { href: "/about", icon: Info, label: "About" },
];

export default function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5 border-r border-ink-700 bg-ink-900/80 py-3 backdrop-blur">
      <Link href="/" className="mb-2 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-850">
        <Logo size={22} />
      </Link>
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={clsx(
              "group relative grid h-11 w-11 place-items-center rounded-xl transition-colors",
              active ? "bg-brand/15 text-brand" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200",
            )}
          >
            <Icon size={19} strokeWidth={2} />
            {active && <span className="absolute left-0 h-6 w-0.5 rounded-r bg-brand" />}
            <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-xs text-slate-200 shadow-xl group-hover:block">
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
