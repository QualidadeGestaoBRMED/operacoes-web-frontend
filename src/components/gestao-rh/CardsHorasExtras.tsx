import { Clock, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarHoras, minutosDoFator, rotuloDoFator } from "@/lib/gestaoRHHorasExtras";
import type { PainelHorasExtras } from "@/types/gestaoRH";
import { CardIndicador } from "./CardIndicador";

const GRADE = "grid grid-cols-2 gap-3 px-4 pt-4 sm:px-7 xl:grid-cols-4";

export function CardsHorasExtras({ painel }: { painel: PainelHorasExtras | undefined }) {
  if (!painel) {
    return (
      <div className={GRADE}>
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }
  const { cards, com_dado: comDado } = painel;
  // Sem as colunas no período, zero diria "nenhuma hora extra": traço.
  const valor = (minutos: number) => (comDado ? formatarHoras(minutos) : "—");
  const colaboradores = cards.colaboradores_com_hora_extra;

  return (
    <div className={GRADE}>
      <CardIndicador
        rotulo="Horas extras"
        valor={valor(cards.total_minutos)}
        legenda="no período selecionado"
        cor="andamento"
        Icone={Clock}
      />
      {painel.fatores.map(({ fator }) => (
        <CardIndicador
          key={fator}
          rotulo={`Horas extras ${rotuloDoFator(fator, painel)}`}
          valor={valor(minutosDoFator(cards.minutos_por_fator, fator))}
          legenda={`fator ${fator} do VR`}
          cor={fator === "1" ? "neutro" : "atencao"}
          Icone={Clock}
        />
      ))}
      <CardIndicador
        rotulo="Colaboradores"
        valor={comDado ? colaboradores : "—"}
        legenda="com hora extra no período"
        cor="neutro"
        Icone={Users}
      />
    </div>
  );
}
