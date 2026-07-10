import { Bell, PanelLeft, Search } from "lucide-react";

interface TopbarProps {
  usuario?: {
    nome: string;
    iniciais: string;
  };
  sidebarAberta: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ usuario, sidebarAberta, onToggleSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-5 border-b border-border bg-background px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          aria-label={sidebarAberta ? "Esconder menu lateral" : "Exibir menu lateral"}
          aria-pressed={sidebarAberta}
        >
          <PanelLeft className="size-4" />
        </button>

        <label className="flex h-[38px] w-full max-w-[420px] items-center gap-2 rounded-md border border-input bg-input px-3 text-muted-foreground focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
          <Search className="size-4 shrink-0" />
          <input
            type="text"
            placeholder="Buscar módulo, demanda, unidade..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            suppressHydrationWarning
          />
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Notificações"
        >
          <Bell className="size-4" />
        </button>

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
      </div>
    </header>
  );
}
