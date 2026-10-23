import { AlertOctagon, AlertTriangle, ClipboardClock, Hourglass, Percent, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DICA_HORAS_PERDIDAS,
  DICA_PONTOS_PERCENTUAIS,
  corDaDiferenca,
  formatarDiferenca,
  formatarPercentual,
} from "@/lib/gestaoRHAbsenteismo";
import { formatarDiferencaDeHoras, formatarHoras } from "@/lib/gestaoRHHorasExtras";
import type { FaixaAbsenteismo, PainelAbsenteismo } from "@/types/gestaoRH";
import { cn } from "@/lib/utils";
import { CardIndicador } from "./CardIndicador";

// Absenteísmo e Horas perdidas ocupam a linha inteira no celular (2
// colunas), onde a variação não caberia em meia linha; os outros cards vêm
// em pares. Com faixas, 6 cards: 3 por linha no tablet, 6 no computador.
// Sem faixas, 4 cards: uma linha a partir do tablet.
const LARGURA_DOS_PRINCIPAIS = "col-span-2 sm:col-span-1";
const GRADE = {
  comFaixas: "grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7 xl:grid-cols-6",
  semFaixas: "grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-4 sm:px-7",
} as const;

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
  comparativo?: {
    pontos: number;
    nomeAnterior: string;
    parcial: boolean;
    /** Horas perdidas do período anterior; nula se o backend não as devolve. */
    minutosAnteriores?: number | null;
  } | null;
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
      <div className={GRADE.comFaixas}>
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton
            key={indice}
            className={cn("h-[76px] rounded-xl", indice < 2 && LARGURA_DOS_PRINCIPAIS)}
          />
        ))}
      </div>
    );
  }
  const { cards, parametros } = painel;
  // Sem faixas cadastradas ninguém é classificado: os cards de faixa somem.
  const comFaixas = parametros.faixas_cadastradas;
  const meta = parametros.meta_percentual;
  // Sem horas previstas (percentual vazio) não há horas perdidas a mostrar:
  // "0" daria a entender que ninguém faltou.
  const minutos = cards.percentual_periodo === null ? undefined : cards.minutos_ausentes;
  const variacaoDeHoras =
    comparativo && minutos !== undefined && comparativo.minutosAnteriores != null
      ? minutos - comparativo.minutosAnteriores
      : null;

  return (
    <div className={comFaixas ? GRADE.comFaixas : GRADE.semFaixas}>
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
        className={LARGURA_DOS_PRINCIPAIS}
      />
      <CardIndicador
        rotulo="Horas perdidas"
        valor={minutos === undefined ? "—" : formatarHoras(minutos)}
        legenda={
          variacaoDeHoras !== null && comparativo ? (
            <>
              <span className={cn("font-semibold", corDaDiferenca(variacaoDeHoras))}>
                {formatarDiferencaDeHoras(variacaoDeHoras)} vs. {comparativo.nomeAnterior}
              </span>
              {comparativo.parcial && " (parcial)"}
            </>
          ) : (
            "soma das ausências do período"
          )
        }
        cor="andamento"
        Icone={Hourglass}
        rotuloEmDuasLinhas
        dica={DICA_HORAS_PERDIDAS}
        className={LARGURA_DOS_PRINCIPAIS}
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
