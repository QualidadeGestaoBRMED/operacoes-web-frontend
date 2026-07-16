"use client";

import { useEffect, useState } from "react";
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
  const { user, isLoading } = useAuth();

  // Achado no review: sidebarAberta sempre nascia "true", mesmo em tela
  // estreita -- a sidebar (256px fixos) comia boa parte da viewport num
  // celular por padrão. Corrige só depois do mount (sem isso, o server e o
  // client renderizariam estados diferentes no primeiro render e o React
  // acusaria hydration mismatch, já que window não existe no servidor).
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarAberta(false);
    }
  }, []);

  const nome = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.name ||
      user.username ||
      "Usuário"
    : "";
  const usuarioTopbar = user ? { nome, iniciais: iniciaisDe(nome) } : undefined;

  return (
    <div className="flex h-screen">
      {sidebarAberta && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          usuario={usuarioTopbar}
          carregando={isLoading}
          sidebarAberta={sidebarAberta}
          onToggleSidebar={() => setSidebarAberta((aberta) => !aberta)}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
