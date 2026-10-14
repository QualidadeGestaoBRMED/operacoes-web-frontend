import { AlertOctagon, AlertTriangle, ClipboardClock, Percent, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarPercentual } from "@/lib/gestaoRHAbsenteismo";
import type { FaixaAbsenteismo, PainelAbsenteismo } from "@/types/gestaoRH";
import { CardIndicador } from "./CardIndicador";

function plural(quantidade: number, singular: string, plural: string) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

interface CardsAbsenteismoProps {
  painel: PainelAbsenteismo | undefined;
  /** Faixa aplicada sozinha no filtro: o card dela aparece selecionado. */
  faixaSelecionada?: FaixaAbsenteismo;
  /** Clique no card de faixa: atalho para listar só aquela faixa. */
  onSelecionarFaixa?: (faixa: FaixaAbsenteismo) => void;
}

export function CardsAbsenteismo({ painel, faixaSelecionada, onSelecionarFaixa }: CardsAbsenteismoProps) {
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
        rotuloEmDuasLinhas
      />
      {comFaixas && (
        <CardIndicador
          rotulo="Faixa crítica"
          valor={cards.faixa_critica}
          legenda="geram demanda para a coordenação"
          cor="vencido"
          Icone={AlertOctagon}
          rotuloEmDuasLinhas
          onClick={onSelecionarFaixa && (() => onSelecionarFaixa("critica"))}
          selecionado={faixaSelecionada === "critica"}
        />
      )}
      {comFaixas && (
        <CardIndicador
          rotulo="Faixa de atenção"
          valor={cards.faixa_atencao}
          legenda="acompanhados no painel"
          cor="atencao"
          Icone={AlertTriangle}
          rotuloEmDuasLinhas
          onClick={onSelecionarFaixa && (() => onSelecionarFaixa("atencao"))}
          selecionado={faixaSelecionada === "atencao"}
        />
      )}
      <CardIndicador
        rotulo="Justificativas pendentes no VR"
        valor={cards.pendencias}
        legenda={`${plural(cards.colaboradores_provisorios, "colaborador", "colaboradores")} com valor provisório`}
        cor="neutro"
        Icone={ClipboardClock}
        rotuloEmDuasLinhas
      />
      <CardIndicador
        rotulo="Colaboradores"
        valor={cards.colaboradores}
        // Sem "em": parte dos colaboradores (TMO, Campanha) não tem unidade, e
        // os cards não dizem quantos; as linhas, filtradas por faixa, também não.
        legenda={plural(cards.unidades, "unidade", "unidades")}
        cor="neutro"
        Icone={Users}
        rotuloEmDuasLinhas
      />
    </div>
  );
}
