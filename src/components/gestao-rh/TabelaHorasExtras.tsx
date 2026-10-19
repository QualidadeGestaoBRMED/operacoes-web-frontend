import { ListFilter, UserCheck } from "lucide-react";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { Skeleton } from "@/components/ui/skeleton";
import { unidadeOuEquipe } from "@/lib/gestaoRHAbsenteismo";
import {
  formatarHoras,
  minutosDoFator,
  rotuloDoFator,
  type CampoOrdenavelHorasExtras,
  type OrdenacaoHorasExtras,
} from "@/lib/gestaoRHHorasExtras";
import { cn, iniciaisDe } from "@/lib/utils";
import type { LinhaHorasExtras, PainelHorasExtras } from "@/types/gestaoRH";
import {
  CLASSE_CABECALHO,
  CLASSE_CABECALHO_FIXO,
  CLASSE_CELULA_FIXA,
  CLASSE_ROLAGEM_SEM_FADE_INICIAL,
} from "./colunaFixa";

// Moldura com 10 linhas inteiras e o cabeçalho; rolagem por dentro, como nas
// outras tabelas do Gestão RH. Alturas medidas no navegador: a linha tem
// h-[58px] mais a borda; o nome de equipe em duas linhas cabe nela.
const LINHAS_VISIVEIS = 10;
const ALTURA_DA_LINHA = 58.25;
const ALTURA_DO_CABECALHO = 41;
const ALTURA_DA_MOLDURA = LINHAS_VISIVEIS * ALTURA_DA_LINHA + ALTURA_DO_CABECALHO;

interface Coluna {
  rotulo: string;
  largura: string;
  campo: CampoOrdenavelHorasExtras;
}

interface TabelaHorasExtrasProps {
  painel: PainelHorasExtras | undefined;
  linhas: LinhaHorasExtras[];
  carregandoPrimeiraVez: boolean;
  ordenacao: OrdenacaoHorasExtras | null;
  onOrdenar: (campo: CampoOrdenavelHorasExtras) => void;
  /** Celular: a página rola inteira, sem a moldura de altura travada. */
  rolagemNaPagina?: boolean;
  /** Filtro trocado e a resposta nova ainda não chegou. */
  atualizando?: boolean;
  onAbrir: (linha: LinhaHorasExtras) => void;
  /** Colaborador mostrado sozinho (escolhido no gráfico ou pelo filtro da linha). */
  selecionado: LinhaHorasExtras | null;
  /** Filtro da linha: o mesmo efeito do clique na barra do gráfico, pelo teclado. */
  onSelecionar: (linha: LinhaHorasExtras | null) => void;
}

export function TabelaHorasExtras({
  painel,
  linhas,
  carregandoPrimeiraVez,
  ordenacao,
  onOrdenar,
  rolagemNaPagina = false,
  atualizando = false,
  onAbrir,
  selecionado,
  onSelecionar,
}: TabelaHorasExtrasProps) {
  const colunas: Coluna[] = [
    { rotulo: "Colaborador", largura: "w-[28%]", campo: "colaborador" },
    { rotulo: "Unidade", largura: "w-[20%]", campo: "unidade" },
    { rotulo: rotuloDoFator("1", painel), largura: "w-[13%]", campo: "fator_1" },
    { rotulo: rotuloDoFator("2", painel), largura: "w-[13%]", campo: "fator_2" },
    { rotulo: "Total", largura: "w-[13%]", campo: "total" },
    { rotulo: "Dias com HE", largura: "w-[13%]", campo: "dias" },
  ];

  return (
    <div className="flex flex-col px-4 pb-6 sm:px-7 sm:pb-7">
      <div
        aria-busy={atualizando || undefined}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-card transition-opacity",
          atualizando && "opacity-60",
        )}
      >
        <div
          data-testid="rolagem-horas-extras"
          style={{ maxHeight: rolagemNaPagina ? undefined : ALTURA_DA_MOLDURA }}
          className={cn(
            "scrollbar-discreta scroll-fade-x min-w-0 overflow-auto",
            CLASSE_ROLAGEM_SEM_FADE_INICIAL,
          )}
        >
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                {colunas.map((coluna, indice) => (
                  <CabecalhoOrdenavel
                    key={coluna.campo}
                    campo={coluna.campo}
                    rotulo={coluna.rotulo}
                    ordenacao={ordenacao}
                    onOrdenar={onOrdenar}
                    className={cn(
                      "sticky top-0 border-b border-border bg-muted px-3 py-2.5 text-left text-[13px] font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase",
                      indice === 0 ? CLASSE_CABECALHO_FIXO : CLASSE_CABECALHO,
                      coluna.largura,
                    )}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {carregandoPrimeiraVez ? (
                Array.from({ length: 6 }, (_, indice) => (
                  <tr key={indice}>
                    {colunas.map((coluna) => (
                      <td key={coluna.campo} className="border-b border-border p-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={colunas.length} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <UserCheck aria-hidden className="size-8" />
                      <span className="text-sm font-medium">
                        Nenhum colaborador encontrado com essa busca
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
                            {[linha.colaborador.matricula_vr, linha.colaborador.cargo].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        {/* No computador, aparece no hover e no foco (no celular, sempre);
                            fica visível enquanto ativo. */}
                        <button
                          type="button"
                          aria-pressed={linha === selecionado}
                          aria-label={
                            linha === selecionado ? "Mostrar todos" : `Mostrar só ${linha.colaborador.nome}`
                          }
                          title={linha === selecionado ? "Mostrar todos" : "Mostrar só este colaborador"}
                          onClick={(evento) => {
                            evento.stopPropagation();
                            onSelecionar(linha === selecionado ? null : linha);
                          }}
                          className={cn(
                            "ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none",
                            linha === selecionado
                              ? "bg-secondary/10 text-secondary opacity-100"
                              : "sm:opacity-0 sm:group-hover:opacity-100",
                          )}
                        >
                          <ListFilter aria-hidden className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[13px]" title={unidadeOuEquipe(linha)}>
                      <span className="line-clamp-2 break-words">{unidadeOuEquipe(linha)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] tabular-nums">
                      {formatarHoras(minutosDoFator(linha.minutos_por_fator, "1"))}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] tabular-nums">
                      {formatarHoras(minutosDoFator(linha.minutos_por_fator, "2"))}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums">
                      {formatarHoras(linha.total_minutos)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] tabular-nums">{linha.dias_com_hora_extra}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!carregandoPrimeiraVez && (
        <p className="pt-3 text-[12px] text-muted-foreground">
          {linhas.length} {linhas.length === 1 ? "colaborador" : "colaboradores"}
        </p>
      )}
    </div>
  );
}
