import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  PauseCircle,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { textoDias } from "@/lib/gestaoRHFerias";
import { cn } from "@/lib/utils";
import type { CardsFerias as Cards } from "@/types/gestaoRH";

type CorCard = "vencido" | "atencao" | "andamento" | "neutro";

// Mesmo desenho e semáforo dos cards da Matriz de Conformidade
// (legalizacao/ResumoCards.tsx): card tingido na cor, número grande, ícone.
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

interface CardProps {
  rotulo: string;
  valor: number;
  legenda: string;
  cor: CorCard;
  Icone: LucideIcon;
}

function Card({ rotulo, valor, legenda, cor, Icone }: CardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between rounded-xl border border-border p-4 shadow-sm",
        COR_FUNDO_CARD[cor],
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </div>
        <div className={cn("mt-1 text-2xl font-bold", COR_TEXTO[cor])}>{valor}</div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
          {legenda}
        </div>
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          COR_FUNDO_ICONE[cor],
          COR_TEXTO[cor],
        )}
      >
        <Icone aria-hidden className="size-4" />
      </div>
    </div>
  );
}

const GRADE = "grid grid-cols-2 gap-3 px-7 pt-4 sm:grid-cols-3 xl:grid-cols-5";

export function CardsFerias({ cards }: { cards: Cards | undefined }) {
  if (!cards) {
    return (
      <div className={GRADE}>
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={GRADE}>
      <Card
        rotulo="Limite vencido"
        valor={cards.limite_vencido}
        legenda="férias a pagar em dobro"
        cor="vencido"
        Icone={CalendarX2}
      />
      <Card
        rotulo="Perto do limite"
        valor={cards.perto_do_limite}
        legenda={`a menos de ${textoDias(cards.dias_perto_do_limite)}`}
        cor="atencao"
        Icone={AlertTriangle}
      />
      <Card
        rotulo="Sem programação"
        valor={cards.sem_programacao}
        legenda="após o primeiro alerta"
        cor="atencao"
        Icone={CalendarClock}
      />
      <Card
        rotulo="Acionar o RH"
        valor={cards.substituicao_a_acionar}
        legenda="substituição pendente"
        cor="andamento"
        Icone={UserRoundCog}
      />
      <Card
        rotulo="Programação adiada"
        valor={cards.programacao_adiada}
        legenda="com justificativa registrada"
        cor="neutro"
        Icone={PauseCircle}
      />
    </div>
  );
}
