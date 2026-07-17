"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn, iniciaisDe } from "@/lib/utils";
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
    // bg-sidebar preenche o vão dos cantos arredondados do main -- sem
    // isso o recorte não aparece, já que por trás dele o body já é claro
    // igual ao main (mesma cor, sem contraste pra revelar a curva).
    <div className="flex h-screen bg-sidebar">
      {/* Sempre montada -- só a largura do wrapper anima (0 <-> 16rem), com
          overflow-hidden escondendo o conteúdo durante a transição. Trocar
          por mount/unmount condicional (como antes) não dá pra animar. */}
      <div
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          sidebarAberta ? "w-64" : "w-0",
        )}
      >
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          usuario={usuarioTopbar}
          carregando={isLoading}
          sidebarAberta={sidebarAberta}
          onToggleSidebar={() => setSidebarAberta((aberta) => !aberta)}
        />
        {/* overflow-y-auto (não hidden): main é só um fallback de
            segurança, não quem normalmente rola. No caso comum, a área das
            colunas do Kanban (flex-1 min-h-0) absorve toda a sobra/déficit
            de altura sozinha e nada extravasa main -- então este scroll
            fica dormente e cada coluna continua rolando por conta própria.
            Ele só entra em ação no caso extremo em que o cabeçalho
            (ResumoCards + filtros, que podem quebrar linha) sozinho já não
            cabe (celular em paisagem, janela bem baixa) -- achado no code
            review: com overflow-hidden isso ficava cortado sem nenhum jeito
            de alcançar. O canto arredondado só faz sentido com a sidebar
            visível ao lado -- sem ela, main encosta na borda esquerda da
            tela e o arredondamento fica solto, sem chrome escuro por trás
            pra revelar a curva. */}
        <main
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-background transition-[border-radius] duration-300",
            sidebarAberta && "rounded-tl-3xl rounded-bl-3xl",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
