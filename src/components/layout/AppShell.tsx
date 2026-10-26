"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { QUERY_MOBILE, useMediaQuery } from "@/hooks/useMediaQuery";
import { AlertaPersistenteModal } from "@/components/legalizacao/AlertaPersistenteModal";
import { JanelaDeDestaque } from "@/components/novidades/JanelaDeDestaque";
import { sincronizarPush } from "@/lib/pushNotificacoes";
import { cn, iniciaisDe } from "@/lib/utils";
import { AbasDoModulo } from "./AbasDoModulo";
import { BarraInferior } from "./BarraInferior";
import { FaixaVerComo } from "./FaixaVerComo";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const ehMobile = useMediaQuery(QUERY_MOBILE);
  const { user, isLoading } = useAuth();

  // No celular não há menu lateral (STC-787): a navegação é a barra
  // inferior. Ao voltar para uma tela larga, o menu lateral abre de novo.
  useEffect(() => {
    if (!ehMobile) setSidebarAberta(true);
  }, [ehMobile]);

  // Notificações no celular (STC-851): a inscrição do aparelho passa para
  // quem está logado, uma vez por usuário.
  const idDoUsuario = user?.id;
  useEffect(() => {
    if (idDoUsuario) void sincronizarPush();
  }, [idDoUsuario]);

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
    // h-svh (não h-screen/100vh nem h-dvh): achado testando em celular real
    // (Android, STC-505) -- 100vh não desconta a barra de navegação do
    // sistema (gestos/3 botões), cortando a parte de baixo do conteúdo,
    // inacessível mesmo rolando. 100dvh corrigia o corte mas quebrava a
    // rolagem em si -- ela recalcula a altura EM TEMPO REAL conforme a
    // barra de endereço do Chrome esconde/aparece durante o gesto, e isso
    // briga com o overflow-y-auto interno (main, abaixo), travando o
    // scroll no meio do caminho. 100svh ("small viewport height") sempre
    // assume a barra aberta -- valor estável, nunca recalcula durante o
    // gesto, e por ser a MENOR altura possível nunca fica maior que a área
    // de fato visível (resolve o corte sem reintroduzir o travamento).
    <div className="flex h-svh flex-col bg-sidebar">
      {/* "Ver como" (STC-790): acima de tudo, em todas as telas. */}
      <FaixaVerComo />
      <div className="flex min-h-0 flex-1">
        {/* Celular: sem menu lateral; a navegação é a barra inferior, no fim
            da coluna abaixo (STC-787). Computador/tablet: "push" -- só a
            largura do wrapper anima (0 <-> 16rem), com overflow-hidden
            escondendo o conteúdo durante a transição. */}
        {!ehMobile && (
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
            onToggleSidebar={ehMobile ? undefined : () => setSidebarAberta((aberta) => !aberta)}
          />
          {ehMobile && <AbasDoModulo />}
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
          {/* Parte do layout, não flutuando: o conteúdo nunca fica atrás dela. */}
          {ehMobile && <BarraInferior />}
        </div>
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
      {/* Destaque das Novidades (STC-877): abre sozinho, uma vez, e espera
          o alerta persistente acima fechar. */}
      {user && <JanelaDeDestaque />}
    </div>
  );
}
