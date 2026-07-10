"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(true);

  return (
    <div className="flex h-screen">
      {sidebarAberta && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          sidebarAberta={sidebarAberta}
          onToggleSidebar={() => setSidebarAberta((aberta) => !aberta)}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
