import { AlertTriangle, CalendarClock, CalendarX2, PauseCircle, UserRoundCog } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { textoDias } from "@/lib/gestaoRHFerias";
import type { CardsFerias as Cards } from "@/types/gestaoRH";
import { CardIndicador } from "./CardIndicador";

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
        <CardIndicador
          rotulo="Limite vencido"
          valor={cards.limite_vencido}
          legenda="férias a pagar em dobro"
          cor="vencido"
          Icone={CalendarX2}
        />
        <CardIndicador
          rotulo="Perto do limite"
          valor={cards.perto_do_limite}
          legenda={`limite em menos de ${textoDias(cards.dias_perto_do_limite)}`}
          cor="atencao"
          Icone={AlertTriangle}
        />
        <CardIndicador
          rotulo="Sem programação"
          valor={cards.sem_programacao}
          legenda="já alertados, sem férias marcadas"
          cor="atencao"
          Icone={CalendarClock}
        />
        <CardIndicador
          rotulo="Acionar o RH"
          valor={cards.substituicao_a_acionar}
          legenda="férias com substituição, RH não acionado"
          cor="andamento"
          Icone={UserRoundCog}
        />
        <CardIndicador
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
