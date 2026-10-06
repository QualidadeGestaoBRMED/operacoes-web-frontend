import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CorCard = "vencido" | "atencao" | "andamento" | "neutro";

// Card de indicador dos painéis de Gestão RH. Mesmo desenho e semáforo dos
// cards da Matriz de Conformidade (legalizacao/ResumoCards.tsx): card tingido
// na cor, número grande, ícone.
const COR_TEXTO: Record<CorCard, string> = {
  vencido: "text-red-600",
  atencao: "text-amber-700",
  andamento: "text-cyan-700",
  neutro: "text-slate-600",
};

const COR_FUNDO_CARD: Record<CorCard, string> = {
  vencido: "bg-red-600/10",
  atencao: "bg-amber-700/10",
  andamento: "bg-cyan-700/10",
  neutro: "bg-slate-500/10",
};

const COR_FUNDO_ICONE: Record<CorCard, string> = {
  vencido: "bg-red-600/15",
  atencao: "bg-amber-700/15",
  andamento: "bg-cyan-700/15",
  neutro: "bg-slate-500/15",
};

interface CardIndicadorProps {
  rotulo: string;
  valor: number | string;
  legenda: string;
  cor: CorCard;
  Icone: LucideIcon;
}

export function CardIndicador({ rotulo, valor, legenda, cor, Icone }: CardIndicadorProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-2 rounded-xl border border-border p-4 shadow-sm",
        COR_FUNDO_CARD[cor],
      )}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:truncate">
          {rotulo}
        </div>
        <div className={cn("mt-1 text-2xl font-bold", COR_TEXTO[cor])}>{valor}</div>
        <div className="mt-0.5 line-clamp-2 text-[11px] font-medium text-muted-foreground">
          {legenda}
        </div>
      </div>
      <div
        className={cn(
          "hidden size-9 shrink-0 items-center justify-center self-center rounded-full sm:flex",
          COR_FUNDO_ICONE[cor],
          COR_TEXTO[cor],
        )}
      >
        <Icone aria-hidden className="size-4" />
      </div>
    </div>
  );
}
