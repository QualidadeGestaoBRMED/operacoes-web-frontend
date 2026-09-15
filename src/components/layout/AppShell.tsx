"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AlertaPersistenteModal } from "@/components/legalizacao/AlertaPersistenteModal";
import { cn, iniciaisDe } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const QUERY_MOBILE = "(max-width: 767px)";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const ehMobile = useMediaQuery(QUERY_MOBILE);
  const { user, isLoading } = useAuth();

  // Achado no dogfooding (visto 1º na tela de Admin, mas era de qualquer
  // página -- Kanban incluso): "push" (largura do wrapper animando entre 0
  // e 16rem) em mobile deixava só ~130px pra página inteira quando o menu
  // era aberto -- achatava TUDO, não só texto, não importa a página.
  // Fecha sozinha ao entrar (ou redimensionar pra) uma tela estreita --
  // nunca reabre sozinha (reabrir é sempre ação manual via
  // onToggleSidebar), pra não brigar com uma escolha do usuário se
  // ehMobile virar false de novo.
  useEffect(() => {
    if (ehMobile) setSidebarAberta(false);
  }, [ehMobile]);

  // Trava o scroll do conteúdo atrás do menu aberto (mobile) -- sem isso,
  // um gesto de rolagem sobre o backdrop ainda rola a página por baixo,
  // mesmo com o menu por cima bloqueando clique.
  useEffect(() => {
    if (!ehMobile || !sidebarAberta) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [ehMobile, sidebarAberta]);

  function fecharSidebar() {
    setSidebarAberta(false);
  }

  // Esc fecha o menu -- mesma expectativa de qualquer overlay (Dialog,
  // Popover etc. do Radix já fazem isso; isto é HTML puro, não herda de
  // graça).
  useEffect(() => {
    if (!ehMobile || !sidebarAberta) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fecharSidebar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ehMobile, sidebarAberta]);

  const nome = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.name ||
      user.username ||
      "Usuário"
    : "";
  const usuarioTopbar = user
    ? { nome, iniciais: iniciaisDe(nome), imagem: user.image }
    : undefined;

  return (
    // bg-sidebar preenche o vão dos cantos arredondados do main -- sem
    // isso o recorte não aparece, já que por trás dele o body já é claro
    // igual ao main (mesma cor, sem contraste pra revelar a curva).
    <div className="flex h-screen bg-sidebar">
      {ehMobile ? (
        <>
          {/* Backdrop: só existe (e só bloqueia clique/toque) com o menu
              aberto -- fecha ao tocar fora. fade-in via transition-opacity
              (não um corte seco) + a sidebar com shadow-2xl (sensação de
              elevação, flutuando de verdade, não só "por cima achatado"). */}
          <div
            data-testid="sidebar-backdrop"
            onClick={fecharSidebar}
            aria-hidden="true"
            className={cn(
              "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
              sidebarAberta
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            )}
          />
          {/* position: fixed (não "push"): a página por trás nunca perde
              largura nem reflui -- só o menu desliza por cima (translate-x),
              exatamente como pedido: a presença do menu não impacta a
              página principal em nada. */}
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transition-transform duration-300 ease-in-out",
              sidebarAberta ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <Sidebar onNavegar={fecharSidebar} />
          </div>
        </>
      ) : (
        /* Desktop/tablet: "push" -- só a largura do wrapper anima (0 <->
           16rem), com overflow-hidden escondendo o conteúdo durante a
           transição. Aqui sobra espaço de sobra, então empurrar em vez de
           flutuar é mais previsível (nada cobre o conteúdo). */
        <div
          className={cn(
            "shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
            sidebarAberta ? "w-64" : "w-0",
          )}
        >
          <Sidebar />
        </div>
      )}
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
            "empurrando" de verdade (modo push) -- em mobile ela flutua por
            cima sem tirar espaço nenhum de main, então nunca teria a curva
            revelada mesmo aberta. */}
        <main
          className={cn(
            // overflow-x-hidden: rede de segurança -- achado no code review
            // (usuário testando em mobile, Chrome DevTools iPhone 16 Pro
            // Max): a barra de rolagem horizontal do PRÓPRIO viewport
            // aparecia em telas estreitas. Não reproduzi programaticamente
            // (Playwright + a mesma emulação não escapou nenhum elemento em
            // nenhum cenário testado), mas custa zero garantir aqui -- se
            // algum conteúdo filho algum dia crescer além da largura
            // disponível (min-w-0 faltando em algum lugar da árvore, ex.),
            // isso contém sem afetar o scroll vertical normal.
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background transition-[border-radius] duration-300",
            !ehMobile && sidebarAberta && "rounded-tl-3xl rounded-bl-3xl",
          )}
        >
          {children}
        </main>
      </div>
      {/* STC-443: montado uma vez aqui (não por tela) -- alerta regulatório
          persistente (RN22) tem que interromper em qualquer lugar da
          plataforma, não só nas telas de Legalização. Só depois do usuário
          resolvido -- sem sessão, useAlertasPendentes só bateria 401 à toa.
          Suspense exigido pelo App Router: usa useSearchParams() (pra saber
          se já há um documento aberto via URL, achado em code review), 1º
          uso desse hook nesta árvore de layout. */}
      {user && (
        <Suspense fallback={null}>
          <AlertaPersistenteModal />
        </Suspense>
      )}
    </div>
  );
}
