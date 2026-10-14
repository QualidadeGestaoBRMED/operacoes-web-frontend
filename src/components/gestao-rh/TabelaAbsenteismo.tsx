import { ArrowDown, ArrowUp, ArrowUpDown, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import {
  COR_FAIXA,
  ROTULO_FAIXA,
  formatarPercentual,
  formatarSaldoHoras,
  textoOcorrencias,
  unidadeOuEquipe,
  type CampoOrdenavelAbsenteismo,
  type OrdenacaoAbsenteismo,
} from "@/lib/gestaoRHAbsenteismo";
import { cn, iniciaisDe } from "@/lib/utils";
import type { LinhaPainelAbsenteismo } from "@/types/gestaoRH";
import {
  CLASSE_CABECALHO,
  CLASSE_CABECALHO_FIXO,
  CLASSE_CELULA_FIXA,
  CLASSE_ROLAGEM_SEM_FADE_INICIAL,
} from "./colunaFixa";

interface Coluna {
  rotulo: string;
  largura: string;
  campo: CampoOrdenavelAbsenteismo;
}

const COLUNAS: Coluna[] = [
  { rotulo: "Colaborador", largura: "w-[19%]", campo: "colaborador" },
  { rotulo: "Unidade / equipe", largura: "w-[12%]", campo: "unidade" },
  { rotulo: "Absenteísmo", largura: "w-[16%]", campo: "percentual" },
  { rotulo: "Dias trab.", largura: "w-[11%]", campo: "dias_trabalhados" },
  { rotulo: "Conformidade", largura: "w-[13%]", campo: "conformidade" },
  { rotulo: "Ocorrências", largura: "w-[18%]", campo: "ocorrencias" },
  { rotulo: "Banco h.", largura: "w-[11%]", campo: "banco_horas" },
];

function CelulaOcorrencias({
  linha,
  limiteMinutos,
}: {
  linha: LinhaPainelAbsenteismo;
  limiteMinutos: number;
}) {
  const { ausencias, jornada } = textoOcorrencias(linha);
  return (
    <td className="px-3 py-2.5 text-[12.5px]">
      {!ausencias && !jornada ? (
        <span className="text-muted-foreground">Nenhuma</span>
      ) : (
        <>
          {ausencias && <div className="truncate">{ausencias}</div>}
          {jornada && (
            <div
              className="truncate text-[11.5px] text-muted-foreground"
              title={`Acima de ${limiteMinutos} minutos`}
            >
              {jornada} &gt;{limiteMinutos}min
            </div>
          )}
        </>
      )}
    </td>
  );
}

interface TabelaAbsenteismoProps {
  linhas: LinhaPainelAbsenteismo[];
  carregandoPrimeiraVez: boolean;
  limiteAtrasoMinutos: number;
  refTabela: ReturnType<typeof useAlturaSemLinhaCortada>["refTabela"];
  maxHeight: number | undefined;
  ordenacao: OrdenacaoAbsenteismo | null;
  onOrdenar: (campo: CampoOrdenavelAbsenteismo) => void;
  /** Celular: a página rola inteira, sem a moldura de altura travada. */
  rolagemNaPagina?: boolean;
  /** Filtro trocado e a resposta nova ainda não chegou. */
  atualizando?: boolean;
  onAbrir: (linha: LinhaPainelAbsenteismo) => void;
}

function CelulaAbsenteismo({ linha }: { linha: LinhaPainelAbsenteismo }) {
  return (
    <td className="px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            linha.faixa === "critica" && "text-red-600",
            linha.faixa === "atencao" && "text-amber-700",
          )}
        >
          {formatarPercentual(linha.percentual)}
        </span>
        {linha.faixa && (
          <span
            className={cn(
              "truncate rounded-full px-2 py-px text-[10.5px] font-bold text-white uppercase",
              COR_FAIXA[linha.faixa],
            )}
          >
            {ROTULO_FAIXA[linha.faixa]}
          </span>
        )}
      </div>
      {linha.provisorio && (
        <div className="truncate text-[11.5px] text-muted-foreground">
          provisório · {linha.pendencias}{" "}
          {linha.pendencias === 1 ? "justificativa pendente no VR" : "justificativas pendentes no VR"}
        </div>
      )}
    </td>
  );
}

export function TabelaAbsenteismo({
  linhas,
  carregandoPrimeiraVez,
  limiteAtrasoMinutos,
  refTabela,
  maxHeight,
  ordenacao,
  onOrdenar,
  rolagemNaPagina = false,
  atualizando = false,
  onAbrir,
}: TabelaAbsenteismoProps) {
  return (
    <div className={cn("flex flex-col px-4 pb-6 sm:px-7 sm:pb-7", !rolagemNaPagina && "min-h-0 flex-1")}>
      {/* Mesmo padrão do Painel de Férias e da Matriz de Conformidade:
          moldura travada em linhas inteiras, rolagem por dentro. */}
      <div
        style={{ maxHeight: rolagemNaPagina ? undefined : maxHeight }}
        aria-busy={atualizando || undefined}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-card transition-opacity",
          !rolagemNaPagina && "min-h-0 flex-1",
          atualizando && "opacity-60",
        )}
      >
        <div
          ref={refTabela}
          className={cn(
            "scrollbar-discreta scroll-fade-x h-full min-w-0 overflow-auto",
            CLASSE_ROLAGEM_SEM_FADE_INICIAL,
          )}
        >
          <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                {COLUNAS.map((coluna, indice) => {
                  const ativa = ordenacao?.campo === coluna.campo;
                  const Icone = !ativa ? ArrowUpDown : ordenacao?.direcao === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={coluna.campo}
                      aria-sort={
                        ativa ? (ordenacao?.direcao === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        "sticky top-0 border-b border-border bg-muted px-3 py-2.5 text-left text-[13px] font-bold tracking-wide text-muted-foreground uppercase",
                        indice === 0 ? CLASSE_CABECALHO_FIXO : CLASSE_CABECALHO,
                        coluna.largura,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onOrdenar(coluna.campo)}
                        className={cn(
                          "group flex items-center gap-1 text-left whitespace-nowrap uppercase hover:text-foreground",
                          ativa && "text-foreground",
                        )}
                      >
                        {coluna.rotulo}
                        <Icone
                          aria-hidden
                          className={cn("size-3 shrink-0", !ativa && "opacity-70 group-hover:opacity-100")}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {carregandoPrimeiraVez ? (
                Array.from({ length: 8 }, (_, indice) => (
                  <tr key={indice}>
                    {COLUNAS.map((coluna) => (
                      <td key={coluna.campo} className="border-b border-border p-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <UserCheck aria-hidden className="size-8" />
                      <span className="text-sm font-medium">
                        Nenhum colaborador encontrado com esses filtros
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                linhas.map((linha) => (
                  <tr
                    key={linha.colaborador.id}
                    onClick={() => onAbrir(linha)}
                    className="group h-[58px] cursor-pointer transition-colors hover:bg-secondary/5 [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                  >
                    {/* A <tr> segue como linha de tabela para o leitor de
                        tela; o teclado chega pelo botão com o nome. */}
                    <td className={cn("px-3 py-2.5", CLASSE_CELULA_FIXA)}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10.5px] font-bold text-secondary-foreground">
                          {iniciaisDe(linha.colaborador.nome)}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(evento) => {
                              evento.stopPropagation();
                              onAbrir(linha);
                            }}
                            className="block w-full truncate rounded text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
                          >
                            {linha.colaborador.nome}
                          </button>
                          {/* Os relatórios do VR não trazem matrícula: sem ela, só o cargo. */}
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {[linha.colaborador.matricula_vr, linha.colaborador.cargo].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Nome da equipe do VR é longo ("CAMPANHA - OCUPACIONAL ..."):
                        quebra em até 2 linhas em vez de cortar no começo. */}
                    <td className="px-3 py-2.5 text-[13px]" title={unidadeOuEquipe(linha)}>
                      <span className="line-clamp-2 break-words">{unidadeOuEquipe(linha)}</span>
                    </td>
                    <CelulaAbsenteismo linha={linha} />
                    <td className="truncate px-3 py-2.5 text-[12.5px] tabular-nums">
                      {/* Sem dia previsto (afastado o período todo, admitido depois):
                          traço, como no percentual e na conformidade. */}
                      {linha.dias_previstos === 0
                        ? "—"
                        : `${linha.dias_trabalhados} de ${linha.dias_previstos}`}
                    </td>
                    <td className="truncate px-3 py-2.5 text-[12.5px] tabular-nums">
                      {formatarPercentual(linha.conformidade_percentual)}
                    </td>
                    <CelulaOcorrencias linha={linha} limiteMinutos={limiteAtrasoMinutos} />
                    <td
                      className={cn(
                        "truncate px-3 py-2.5 text-[12.5px] font-medium tabular-nums",
                        linha.banco_horas_saldo_minutos < 0 ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {formatarSaldoHoras(linha.banco_horas_saldo_minutos)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!carregandoPrimeiraVez && (
        <p className="shrink-0 pt-3 text-[12px] text-muted-foreground">
          {linhas.length} {linhas.length === 1 ? "colaborador" : "colaboradores"}
        </p>
      )}
    </div>
  );
}
