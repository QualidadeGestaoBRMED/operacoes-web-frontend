import { AlertOctagon, AlertTriangle, ClipboardClock, Percent, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DICA_PONTOS_PERCENTUAIS,
  corDaDiferenca,
  formatarDiferenca,
  formatarPercentual,
} from "@/lib/gestaoRHAbsenteismo";
import type { FaixaAbsenteismo, PainelAbsenteismo } from "@/types/gestaoRH";
import { cn } from "@/lib/utils";
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
  /** Diferença para o período anterior; nula enquanto carrega ou sem dado para comparar. */
  comparativo?: { pontos: number; nomeAnterior: string; parcial: boolean } | null;
  /** Clique no card de absenteísmo: abre o comparativo com o período anterior. */
  onAbrirComparativo?: () => void;
}

export function CardsAbsenteismo({
  painel,
  faixaSelecionada,
  onSelecionarFaixa,
  comparativo,
  onAbrirComparativo,
}: CardsAbsenteismoProps) {
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
        legenda={
          comparativo ? (
            <>
              <span
                className={cn("font-semibold", corDaDiferenca(comparativo.pontos))}
                title={DICA_PONTOS_PERCENTUAIS}
              >
                {formatarDiferenca(comparativo.pontos)} vs. {comparativo.nomeAnterior}
              </span>
              {comparativo.parcial && " (parcial)"}
              {meta && ` · limite: ${formatarPercentual(meta)}`}
            </>
          ) : meta ? (
            `limite: ${formatarPercentual(meta)}`
          ) : (
            "no período selecionado"
          )
        }
        cor={
          meta && cards.percentual_periodo && Number(cards.percentual_periodo) > Number(meta)
            ? "vencido"
            : "andamento"
        }
        Icone={Percent}
        rotuloEmDuasLinhas
        onClick={onAbrirComparativo}
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
        // Sem "em": é a contagem dos cards, e as linhas, filtradas por faixa,
        // não mostram todas essas unidades.
        legenda={plural(cards.unidades, "unidade", "unidades")}
        cor="neutro"
        Icone={Users}
        rotuloEmDuasLinhas
      />
    </div>
  );
}
