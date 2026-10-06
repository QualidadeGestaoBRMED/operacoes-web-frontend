import { CalendarCheck2 } from "lucide-react";
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
} from "@/lib/gestaoRHFerias";
import { cn, iniciaisDe } from "@/lib/utils";
import type { LinhaPainelFerias } from "@/types/gestaoRH";

const COLUNAS = [
  { rotulo: "Colaborador", largura: "w-[18%]" },
  { rotulo: "Unidade", largura: "w-[10%]" },
  { rotulo: "Período de direito", largura: "w-[16%]" },
  { rotulo: "Limite", largura: "w-[9%]" },
  { rotulo: "Próximo marco", largura: "w-[16%]" },
  { rotulo: "Status", largura: "w-[16%]" },
  { rotulo: "Situação", largura: "w-[15%]" },
];

interface TabelaFeriasProps {
  linhas: LinhaPainelFerias[];
  carregandoPrimeiraVez: boolean;
  hoje: string;
  refTabela: ReturnType<typeof useAlturaSemLinhaCortada>["refTabela"];
  maxHeight: number | undefined;
  /** Celular: a página rola inteira, sem a moldura de altura travada. */
  rolagemNaPagina?: boolean;
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
  rolagemNaPagina = false,
  onAbrir,
}: TabelaFeriasProps) {
  return (
    <div className={cn("flex flex-col px-4 pb-6 sm:px-7 sm:pb-7", !rolagemNaPagina && "min-h-0 flex-1")}>
      {/* Mesmo padrão da Matriz de Conformidade: moldura com borda travada
          em linhas inteiras, rolagem por dentro e cabeçalho fixo. */}
      <div
        style={{ maxHeight: rolagemNaPagina ? undefined : maxHeight }}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-card",
          !rolagemNaPagina && "min-h-0 flex-1",
        )}
      >
        <div
          ref={refTabela}
          className="scrollbar-discreta scroll-fade-x h-full min-w-0 overflow-auto"
        >
          <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th
                    key={coluna.rotulo}
                    className={cn(
                      "sticky top-0 border-b border-border bg-muted px-3 py-2.5 text-left text-[13px] font-bold tracking-wide text-muted-foreground uppercase",
                      coluna.largura,
                    )}
                  >
                    {coluna.rotulo}
                  </th>
                ))}
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
                    className="h-[58px] cursor-pointer transition-colors hover:bg-secondary/5 [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                  >
                    {/* A <tr> segue como linha de tabela para o leitor de
                        tela; o teclado chega pelo botão com o nome. */}
                    <td className="px-3 py-2.5">
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
                      {linha.colaborador.unidade.nome}
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
