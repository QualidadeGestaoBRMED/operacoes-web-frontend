import { Bell, PanelLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-5 border-b border-border bg-background px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarAberta ? "Esconder menu lateral" : "Exibir menu lateral"}
          aria-pressed={sidebarAberta}
        >
          <PanelLeft className="size-4" />
        </Button>

        <div className="relative w-full max-w-[420px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar módulo, demanda, unidade..."
            className="h-[38px] bg-input pl-9"
            suppressHydrationWarning
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <Button type="button" variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="size-4" />
        </Button>

        {carregando ? (
          <div className="flex items-center gap-2">
            <div className="size-8 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {usuario?.iniciais ?? "?"}
            </div>
            {usuario ? (
              <span>
                Olá, <strong>{usuario.nome}</strong>
              </span>
            ) : (
              <span className="text-muted-foreground">Não autenticado</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
