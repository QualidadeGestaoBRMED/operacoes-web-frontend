"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, PanelLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGINAS } from "@/config/paginas";

interface TopbarProps {
  usuario?: {
    nome: string;
    iniciais: string;
  };
  // Distingue "sessao ainda carregando" de "sem sessao" -- sem isso, a
  // janela entre o mount do client e a resposta de useSession() mostrava
  // "Nao autenticado" pra um usuario que ja estava autenticado de verdade
  // (o middleware ja tinha confirmado isso no servidor).
  carregando?: boolean;
  sidebarAberta: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ usuario, carregando, sidebarAberta, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname();
  const pagina = PAGINAS.find((p) => pathname.startsWith(p.prefixo));

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-stretch bg-sidebar text-sidebar-foreground">
      {/* Largura igual à da Sidebar (w-64) -- cria a costura visual entre o
          header e a navegação lateral logo abaixo, como no ProntuAI. */}
      <div className="flex w-64 shrink-0 items-center px-3">
        <Image
          src="/brand/logo-brmed.webp"
          alt="BR MED Saúde Corporativa"
          width={200}
          height={45}
          priority
          className="h-9 w-auto"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4 border-l border-sidebar-border px-7">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarAberta ? "Esconder menu lateral" : "Exibir menu lateral"}
          aria-pressed={sidebarAberta}
          className="text-sidebar-foreground hover:text-accent-foreground"
        >
          <PanelLeft className="size-4" />
        </Button>

        {pagina && (
          <>
            <div className="flex shrink-0 items-center gap-2 text-[15px] font-semibold text-sidebar-foreground">
              <pagina.icon className="size-[18px] text-sidebar-foreground/70" />
              {pagina.titulo}
            </div>
            <div className="h-6 w-px shrink-0 bg-sidebar-border" />
          </>
        )}

        <div className="relative w-full max-w-[420px]">
          <label htmlFor="busca-topbar" className="sr-only">
            Buscar módulo, demanda ou unidade
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="busca-topbar"
            type="text"
            placeholder="Buscar módulo, demanda, unidade..."
            className="h-[38px] bg-input pl-9"
            suppressHydrationWarning
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 pr-7">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className="text-sidebar-foreground hover:text-accent-foreground"
        >
          <Bell className="size-4" />
        </Button>

        {carregando ? (
          <div className="flex items-center gap-2" role="status" aria-label="Carregando sessão">
            <div className="size-8 animate-pulse rounded-full bg-sidebar-foreground/15" />
            <div className="h-4 w-24 animate-pulse rounded bg-sidebar-foreground/15" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
            <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {usuario?.iniciais ?? "?"}
            </div>
            {usuario ? (
              <span>
                Olá, <strong>{usuario.nome}</strong>
              </span>
            ) : (
              <span className="text-sidebar-foreground/60">Não autenticado</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
