"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { iniciaisDe } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

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
    <div className="flex h-screen flex-col">
      <Topbar
        usuario={usuarioTopbar}
        carregando={isLoading}
        sidebarAberta={sidebarAberta}
        onToggleSidebar={() => setSidebarAberta((aberta) => !aberta)}
      />
      {/* bg-sidebar preenche o vão do canto arredondado do main -- sem
          isso o recorte não aparece, já que por trás dele o body já é claro
          igual ao main (mesma cor, sem contraste pra revelar a curva). */}
      <div className="flex min-h-0 flex-1 bg-sidebar">
        {sidebarAberta && <Sidebar />}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-tl-xl bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
