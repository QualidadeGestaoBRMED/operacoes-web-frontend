"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    partes
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const { user } = useAuth();

  const nome = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.name ||
      user.username ||
      ""
    : "";
  const usuarioTopbar = user ? { nome, iniciais: iniciaisDe(nome) } : undefined;

  return (
    <div className="flex h-screen">
      {sidebarAberta && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          usuario={usuarioTopbar}
          sidebarAberta={sidebarAberta}
          onToggleSidebar={() => setSidebarAberta((aberta) => !aberta)}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
