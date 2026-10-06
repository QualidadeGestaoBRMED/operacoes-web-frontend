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

const GRADE = "grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7 xl:grid-cols-5";

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
    <>
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
          legenda={`limite em menos de ${textoDias(cards.dias_perto_do_limite)}`}
          cor="atencao"
          Icone={AlertTriangle}
        />
        <Card
          rotulo="Sem programação"
          valor={cards.sem_programacao}
          legenda="já alertados, sem férias marcadas"
          cor="atencao"
          Icone={CalendarClock}
        />
        <Card
          rotulo="Acionar o RH"
          valor={cards.substituicao_a_acionar}
          legenda="férias com substituição, RH não acionado"
          cor="andamento"
          Icone={UserRoundCog}
        />
        <Card
          rotulo="Programação adiada"
          valor={cards.programacao_adiada}
          legenda="aguardando o próximo marco"
          cor="neutro"
          Icone={PauseCircle}
        />
      </div>
      {/* Cards e tabela não contam a mesma coisa: deixar dito evita alguém
          tentar fechar a conta entre os dois. */}
      <p className="px-4 pt-2 text-[11.5px] text-muted-foreground sm:px-7">
        Os cards contam períodos de férias em qualquer data; a tabela lista os colaboradores com
        marco na janela escolhida.
      </p>
    </>
  );
}
