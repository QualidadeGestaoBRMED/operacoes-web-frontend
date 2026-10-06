import { AlertOctagon, AlertTriangle, ClipboardClock, Percent, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarPercentual } from "@/lib/gestaoRHAbsenteismo";
import type { PainelAbsenteismo } from "@/types/gestaoRH";
import { CardIndicador } from "./CardIndicador";

function plural(quantidade: number, singular: string, plural: string) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

export function CardsAbsenteismo({ painel }: { painel: PainelAbsenteismo | undefined }) {
  if (!painel) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }
  const { cards, parametros } = painel;
  // Sem faixas cadastradas ninguém é classificado: os cards de faixa somem.
  const comFaixas = parametros.faixas_cadastradas;
  const meta = parametros.meta_percentual;

  return (
    <div
      className={
        comFaixas
          ? "grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7 xl:grid-cols-5"
          : "grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7"
      }
    >
      <CardIndicador
        rotulo="Absenteísmo"
        valor={formatarPercentual(cards.percentual_periodo)}
        legenda={meta ? `meta: até ${formatarPercentual(meta)}` : "no período selecionado"}
        cor={
          meta && cards.percentual_periodo && Number(cards.percentual_periodo) > Number(meta)
            ? "vencido"
            : "andamento"
        }
        Icone={Percent}
      />
      {comFaixas && (
        <CardIndicador
          rotulo="Faixa crítica"
          valor={cards.faixa_critica}
          legenda="geram demanda para a coordenação"
          cor="vencido"
          Icone={AlertOctagon}
        />
      )}
      {comFaixas && (
        <CardIndicador
          rotulo="Faixa de atenção"
          valor={cards.faixa_atencao}
          legenda="acompanhados no painel"
          cor="atencao"
          Icone={AlertTriangle}
        />
      )}
      <CardIndicador
        rotulo="Pendências de ponto"
        valor={cards.pendencias}
        legenda={`${plural(cards.colaboradores_provisorios, "colaborador", "colaboradores")} com valor provisório`}
        cor="neutro"
        Icone={ClipboardClock}
      />
      <CardIndicador
        rotulo="Colaboradores"
        valor={cards.colaboradores}
        legenda={`em ${plural(cards.unidades, "unidade", "unidades")}`}
        cor="neutro"
        Icone={Users}
      />
    </div>
  );
}
