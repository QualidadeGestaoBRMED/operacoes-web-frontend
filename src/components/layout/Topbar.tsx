import { Bell, Search } from "lucide-react";

interface TopbarProps {
  usuario?: {
    nome: string;
    iniciais: string;
  };
}

export function Topbar({ usuario }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-5 border-b border-border px-7">
      <label className="flex h-[38px] w-full max-w-[420px] items-center gap-2 rounded-md border border-input bg-input px-3 text-muted-foreground focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
        <Search className="size-4 shrink-0" />
        <input
          type="text"
          placeholder="Buscar módulo, demanda, unidade..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </label>

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
