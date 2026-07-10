import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TomBadge = "sucesso" | "atencao" | "neutro";

const TOM_BADGE: Record<TomBadge, string> = {
  sucesso: "bg-[color-mix(in_srgb,var(--chart-3)_14%,var(--card))] text-[color:var(--chart-3)]",
  atencao: "bg-destructive/15 text-destructive",
  neutro: "bg-muted text-muted-foreground",
};

interface TileChromeProps {
  icon: LucideIcon;
  nome: string;
  descricao: string;
  ativo: boolean;
  badgeLabel: string;
  badgeTom: TomBadge;
  children?: React.ReactNode;
}

function TileChrome({
  icon: Icon,
  nome,
  descricao,
  ativo,
  badgeLabel,
  badgeTom,
  children,
}: TileChromeProps) {
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
            TOM_BADGE[badgeTom],
          )}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="mt-3 text-[15px] font-bold tracking-tight">{nome}</div>
      <p className="mt-[3px] text-xs leading-tight text-muted-foreground">{descricao}</p>
      {children}
    </>
  );
}

export interface EstatisticaTile {
  valor: string;
  rotulo: string;
  atencao?: boolean;
}

interface ModuleTileAtivoProps {
  className?: string;
  icon: LucideIcon;
  nome: string;
  descricao: string;
  href: string;
  estatisticas: EstatisticaTile[];
}

export function ModuleTileAtivo({
  className,
  icon,
  nome,
  descricao,
  href,
  estatisticas,
}: ModuleTileAtivoProps) {
  const temAtencao = estatisticas.some((e) => e.atencao);

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[210px] flex-col rounded-xl border border-border bg-card p-[18px] shadow-sm transition-all hover:-translate-y-0.5 hover:border-secondary hover:shadow-lg",
        className,
      )}
    >
      <TileChrome
        icon={icon}
        nome={nome}
        descricao={descricao}
        ativo
        badgeLabel={temAtencao ? "Urgente" : "Em dia"}
        badgeTom={temAtencao ? "atencao" : "sucesso"}
      >
        <div className="mt-4 flex gap-5">
          {estatisticas.map((estatistica) => (
            <div key={estatistica.rotulo}>
              <div
                className={cn(
                  "text-2xl leading-none font-extrabold tracking-tight",
                  estatistica.atencao ? "text-destructive" : "text-foreground",
                )}
              >
                {estatistica.valor}
              </div>
              <div className="mt-1.5 text-[11px] leading-tight font-medium text-muted-foreground">
                {estatistica.rotulo}
              </div>
            </div>
          ))}
        </div>
      </TileChrome>
      <div className="mt-auto pt-3 text-xs font-bold text-secondary">Ver indicadores completos →</div>
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
    <div
      className={cn(
        "flex min-h-[210px] flex-col rounded-xl border border-border bg-card p-[18px] shadow-sm",
        className,
      )}
    >
      <TileChrome
        icon={icon}
        nome={nome}
        descricao={descricao}
        ativo={false}
        badgeLabel="Em breve"
        badgeTom="neutro"
      />
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
