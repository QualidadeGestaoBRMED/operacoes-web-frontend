import { ArrowDown, ArrowUp, ArrowUpDown, CalendarCheck2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  COR_STATUS_PERIODO,
  ROTULO_STATUS_PERIODO,
  intervalo,
  partesProximoMarco,
  textoProximoMarco,
  textoSituacao,
  type CampoOrdenavelFerias,
  type OrdenacaoFerias,
} from "@/lib/gestaoRHFerias";
import { cn, iniciaisDe } from "@/lib/utils";
import type { LinhaPainelFerias } from "@/types/gestaoRH";
import {
  CLASSE_CABECALHO,
  CLASSE_CABECALHO_FIXO,
  CLASSE_CELULA_FIXA,
  CLASSE_ROLAGEM_SEM_FADE_INICIAL,
} from "./colunaFixa";

const COLUNAS: { rotulo: string; largura: string; campo?: CampoOrdenavelFerias }[] = [
  { rotulo: "Colaborador", largura: "w-[18%]", campo: "colaborador" },
  { rotulo: "Unidade", largura: "w-[10%]", campo: "unidade" },
  { rotulo: "Período de direito", largura: "w-[16%]", campo: "periodo" },
  { rotulo: "Limite", largura: "w-[9%]", campo: "limite" },
  { rotulo: "Próximo marco", largura: "w-[16%]", campo: "proximo_marco" },
  { rotulo: "Status", largura: "w-[16%]", campo: "status" },
  { rotulo: "Situação", largura: "w-[15%]" },
];

interface TabelaFeriasProps {
  linhas: LinhaPainelFerias[];
  carregandoPrimeiraVez: boolean;
  hoje: string;
  refTabela: ReturnType<typeof useAlturaSemLinhaCortada>["refTabela"];
  maxHeight: number | undefined;
  ordenacao: OrdenacaoFerias | null;
  onOrdenar: (campo: CampoOrdenavelFerias) => void;
  /** Celular: a página rola inteira, sem a moldura de altura travada. */
  rolagemNaPagina?: boolean;
  /** Filtro trocado e a resposta nova ainda não chegou. */
  atualizando?: boolean;
  onAbrir: (linha: LinhaPainelFerias) => void;
}

function LinhaEsqueleto() {
  return (
    <tr>
      {COLUNAS.map((coluna) => (
        <td key={coluna.rotulo} className="border-b border-border p-3">
          <Skeleton className="h-4 w-24" />
        </td>
      ))}
    </tr>
  );
}

function corDoProximoMarco(linha: LinhaPainelFerias, hoje: string): string {
  if (linha.limite_vencido_ha_dias !== null) return "font-semibold text-red-600";
  const marco = linha.proximo_marco;
  if (marco?.tipo === "acionar_rh" && marco.data < hoje) return "font-semibold text-red-600";
  if (marco?.tipo === "limite" || marco?.tipo === "acionar_rh") {
    return "font-semibold text-amber-700";
  }
  return "text-muted-foreground";
}

function CelulaProximoMarco({ linha, hoje }: { linha: LinhaPainelFerias; hoje: string }) {
  const { titulo, detalhe } = partesProximoMarco(linha, hoje);
  return (
    <td className="px-3 py-2.5 text-[12.5px]" title={textoProximoMarco(linha, hoje)}>
      <div className={cn("truncate", corDoProximoMarco(linha, hoje))}>{titulo}</div>
      {detalhe && <div className="truncate text-[11.5px] text-muted-foreground">{detalhe}</div>}
    </td>
  );
}

export function TabelaFerias({
  linhas,
  carregandoPrimeiraVez,
  hoje,
  refTabela,
  maxHeight,
  ordenacao,
  onOrdenar,
  rolagemNaPagina = false,
  atualizando = false,
  onAbrir,
}: TabelaFeriasProps) {
  return (
    <div className={cn("flex flex-col px-4 pb-6 sm:px-7 sm:pb-7", !rolagemNaPagina && "min-h-0 flex-1")}>
      {/* Mesmo padrão da Matriz de Conformidade: moldura com borda travada
          em linhas inteiras, rolagem por dentro e cabeçalho fixo. */}
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
                  const ativa = !!coluna.campo && ordenacao?.campo === coluna.campo;
                  const Icone = !ativa ? ArrowUpDown : ordenacao?.direcao === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={coluna.rotulo}
                      aria-sort={
                        ativa ? (ordenacao?.direcao === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        "sticky top-0 border-b border-border bg-muted px-3 py-2.5 text-left text-[13px] font-bold tracking-wide text-muted-foreground uppercase",
                        indice === 0 ? CLASSE_CABECALHO_FIXO : CLASSE_CABECALHO,
                        coluna.largura,
                      )}
                    >
                      {coluna.campo ? (
                        // Mesmo comportamento da Matriz de Conformidade: crescente,
                        // decrescente e de volta à ordem da API.
                        <button
                          type="button"
                          onClick={() => onOrdenar(coluna.campo as CampoOrdenavelFerias)}
                          className={cn(
                            "group flex items-center gap-1 uppercase hover:text-foreground",
                            ativa && "text-foreground",
                          )}
                        >
                          {coluna.rotulo}
                          <Icone
                            aria-hidden
                            className={cn("size-3", !ativa && "opacity-70 group-hover:opacity-100")}
                          />
                        </button>
                      ) : (
                        coluna.rotulo
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {carregandoPrimeiraVez ? (
                Array.from({ length: 8 }, (_, indice) => <LinhaEsqueleto key={indice} />)
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <CalendarCheck2 aria-hidden className="size-8" />
                      <span className="text-sm font-medium">
                        Nenhum colaborador com marco de férias na janela escolhida
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
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {linha.colaborador.matricula_vr}
                            {linha.colaborador.cargo && ` · ${linha.colaborador.cargo}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="truncate px-3 py-2.5 text-[13px]">
                      {linha.colaborador.unidade?.nome ?? "Sem unidade"}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] tabular-nums">
                      <div className="truncate">
                        {intervalo(linha.periodo.inicio_aquisitivo, linha.periodo.fim_aquisitivo)}
                      </div>
                      {linha.outros_periodos_pendentes > 0 && (
                        <div className="truncate text-[11.5px] font-semibold text-red-600">
                          +{linha.outros_periodos_pendentes}{" "}
                          {linha.outros_periodos_pendentes === 1
                            ? "período pendente"
                            : "períodos pendentes"}
                        </div>
                      )}
                    </td>
                    <td className="truncate px-3 py-2.5 text-[12.5px]">
                      {formatarDataISO(linha.periodo.limite_concessivo)}
                    </td>
                    <CelulaProximoMarco linha={linha} hoje={hoje} />
                    <td className="overflow-hidden px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white uppercase",
                          COR_STATUS_PERIODO[linha.periodo.status],
                        )}
                      >
                        {ROTULO_STATUS_PERIODO[linha.periodo.status]}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2.5 text-[12.5px] text-muted-foreground"
                      title={textoSituacao(linha)}
                    >
                      <span className="line-clamp-2">{textoSituacao(linha)}</span>
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
