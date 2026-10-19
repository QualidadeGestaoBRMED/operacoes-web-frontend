"use client";

import { usePathname } from "next/navigation";
import { LogOut, PanelLeft } from "lucide-react";
import { signOut } from "next-auth/react";
import { AvatarUsuario } from "@/components/AvatarUsuario";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAGINAS } from "@/config/paginas";
import { NotificacoesMenu } from "./NotificacoesMenu";

interface TopbarProps {
  usuario?: {
    nome: string;
    iniciais: string;
    imagem?: string | null;
  };
  // Distingue "sessao ainda carregando" de "sem sessao" -- sem isso, a
  // janela entre o mount do client e a resposta de useSession() mostrava
  // "Nao autenticado" pra um usuario que ja estava autenticado de verdade
  // (o middleware ja tinha confirmado isso no servidor).
  carregando?: boolean;
  sidebarAberta: boolean;
  /** Sem ele (celular, STC-787), não há menu lateral e o botão some. */
  onToggleSidebar?: () => void;
}

export function Topbar({ usuario, carregando, sidebarAberta, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname();
  const pagina = PAGINAS.find((p) => pathname.startsWith(p.prefixo));

  return (
    <header
      className={[
        "relative flex h-16 shrink-0 items-center gap-3 bg-sidebar px-6 text-sidebar-foreground",
        // Linha fina em gradiente no encontro com a Sidebar -- mesmo truque
        // do ProntuAI (before: com gradiente em vez de uma borda sólida).
        "before:absolute before:inset-y-3 before:left-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-sidebar-foreground/15 before:to-transparent",
      ].join(" ")}
    >
      {onToggleSidebar && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarAberta ? "Esconder menu lateral" : "Exibir menu lateral"}
          aria-pressed={sidebarAberta}
          className="-ms-2 text-sidebar-foreground hover:text-accent-foreground"
        >
          <PanelLeft className="size-4" />
        </Button>
      )}

      {pagina && <h1 className="text-lg font-semibold">{pagina.titulo}</h1>}

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <NotificacoesMenu />

        {carregando ? (
          <div className="flex items-center gap-2" role="status" aria-label="Carregando sessão">
            <div className="size-8 animate-pulse rounded-full bg-sidebar-foreground/15" />
            <div className="h-4 w-24 animate-pulse rounded bg-sidebar-foreground/15" />
          </div>
        ) : usuario ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Achado na auditoria de responsividade (STC-186): o texto
                  "Olá, {nome}" sem nenhum limite de largura empurrava a
                  Topbar inteira pra fora da viewport em 375px -- não era só
                  visualmente apertado, causava overflow horizontal real de
                  PÁGINA (document.documentElement.scrollWidth > clientWidth,
                  medido e confirmado), o que o critério de aceite do ticket
                  proíbe explicitamente. Esconde só o texto abaixo de sm
                  (mantém o avatar, que já basta pra indicar "logado"), com
                  aria-label no botão pra não perder o nome anunciado por
                  leitor de tela quando o texto visível some. */}
              <button
                type="button"
                aria-label={`Olá, ${usuario.nome}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-foreground/10"
              >
                <AvatarUsuario
                  imagem={usuario.imagem}
                  iniciais={usuario.iniciais}
                  className="bg-sidebar-primary text-sidebar-primary-foreground"
                />
                <span className="hidden sm:inline" aria-hidden="true">
                  Olá, <strong>{usuario.nome}</strong>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/login" })}>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
            <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              ?
            </div>
            <span className="text-sidebar-foreground/60">Não autenticado</span>
          </div>
        )}
      </div>
    </header>
  );
}
