import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TileChromeProps {
  className?: string;
  icon: LucideIcon;
  nome: string;
  descricao: string;
  ativo: boolean;
  children?: React.ReactNode;
}

function TileChrome({ className, icon: Icon, nome, descricao, ativo, children }: TileChromeProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <div
          className={cn(
            "flex size-[34px] shrink-0 items-center justify-center rounded-md",
            ativo ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-[18px]" />
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
            ativo
              ? "bg-[color-mix(in_srgb,var(--chart-3)_14%,var(--card))] text-[color:var(--chart-3)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {ativo ? "Ativo" : "Em breve"}
        </span>
      </div>
      <div className="mt-3 text-[15px] font-bold tracking-tight">{nome}</div>
      <p className="mt-[3px] text-xs leading-tight text-muted-foreground">{descricao}</p>
      {children}
    </>
  );
}

interface ModuleTileAtivoProps {
  className?: string;
  icon: LucideIcon;
  nome: string;
  descricao: string;
  href: string;
  children: React.ReactNode;
}

export function ModuleTileAtivo({
  className,
  icon,
  nome,
  descricao,
  href,
  children,
}: ModuleTileAtivoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-[18px] shadow-sm transition-all hover:-translate-y-0.5 hover:border-secondary hover:shadow-lg",
        className,
      )}
    >
      <TileChrome icon={icon} nome={nome} descricao={descricao} ativo>
        {children}
      </TileChrome>
      <div className="mt-2.5 text-xs font-bold text-secondary">Ver indicadores completos →</div>
    </Link>
  );
}

interface ModuleTileMutadoProps {
  className?: string;
  icon: LucideIcon;
  nome: string;
  descricao: string;
  larguras?: string[];
}

export function ModuleTileMutado({
  className,
  icon,
  nome,
  descricao,
  larguras = ["70%", "45%"],
}: ModuleTileMutadoProps) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card p-[18px] shadow-sm", className)}>
      <TileChrome icon={icon} nome={nome} descricao={descricao} ativo={false} />
      <div className="mt-auto flex flex-col gap-2 pt-3">
        {larguras.map((largura, i) => (
          <div
            key={i}
            className="h-[9px] animate-pulse rounded-full bg-muted"
            style={{ width: largura }}
          />
        ))}
      </div>
    </div>
  );
}

export function ModuleTileVazio({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border text-center text-muted-foreground transition-colors hover:border-secondary hover:text-secondary",
        className,
      )}
    >
      <div className="flex size-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-current">
        <Plus className="size-4" />
      </div>
      <span className="text-xs font-bold">Próximo módulo</span>
    </div>
  );
}
