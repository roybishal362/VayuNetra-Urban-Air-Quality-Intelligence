"use client";

import { usePathname } from "next/navigation";
import { CityProvider } from "@/lib/cityStore";
import SideNav from "./SideNav";
import Topbar from "./Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <CityProvider>
      <div className="flex h-[100dvh] overflow-hidden">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-hidden">
            <div key={path} className="vn-fade h-full w-full">{children}</div>
          </main>
        </div>
      </div>
    </CityProvider>
  );
}
