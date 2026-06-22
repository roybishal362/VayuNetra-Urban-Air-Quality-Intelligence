"use client";

import { CityProvider } from "@/lib/cityStore";
import SideNav from "./SideNav";
import Topbar from "./Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CityProvider>
      <div className="flex h-screen overflow-hidden">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </CityProvider>
  );
}
