import { ArrowDown, ArrowUp, ArrowUpDown, FileX2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import {
  COR_CRITICIDADE_ALTA,
  COR_STATUS_BADGE,
  LABEL_CRITICIDADE,
  LABEL_CATEGORIA,
  LABEL_STATUS,
  responsavelPrincipal,
  ORDEM_STATUS,
  prazoDocumento,
  type CampoOrdenavel,
  type Ordenacao,
} from "@/lib/legalizacaoMatriz";
import { cn, iniciaisDe, nomeExibicao } from "@/lib/utils";
import type { DocumentoUnidade } from "@/types/legalizacao";

interface MatrizTableProps {
  documentos: DocumentoUnidade[];
  carregandoPrimeiraVez: boolean;
  ordenacao: Ordenacao | null;
  onOrdenar: (campo: CampoOrdenavel) => void;
  // Vêm de useAlturaSemLinhaCortada() no componente pai (mesmo hook/padrão
  // de GerenciarUsuarios.tsx, na Administração) -- precisam nascer lá, não
  // aqui dentro, porque o cálculo depende da altura do ancestral que
  // também contém a barra de filtros, fora deste componente.
  refTabela: ReturnType<typeof useAlturaSemLinhaCortada>["refTabela"];
  maxHeight: number | undefined;
  // Linha clicável é só afordância visual por enquanto -- o Detalhe do
  // Documento (STC-380) ainda não existe. onClickLinha fica opcional, sem
  // navegação real até essa tela nascer.
  onClickLinha?: (documento: DocumentoUnidade) => void;
}

// Larguras fixas por coluna (table-layout: fixed) -- sem isso, a largura de
// cada coluna reagia ao conteúdo das linhas visíveis no momento (table-
// layout: auto, o default do <table>), então aplicar um filtro que reduzia
// as linhas fazia a tabela inteira "encolher" e as colunas mudarem de
// largura a cada filtro/busca. Somam 100%.
const COLUNAS: { rotulo: string; largura: string; campo: CampoOrdenavel }[] = [
  { rotulo: "Unidade", largura: "w-[12%]", campo: "unidade" },
  { rotulo: "Documento", largura: "w-[24%]", campo: "documento" },
  // 22% (era 16%) -- "Unidade em encerramento" é o rótulo mais longo dos 7
  // status e não cabia na largura antiga, vazando visualmente por cima da
  // coluna Responsável (achado testando em viewport de celular).
  { rotulo: "Status", largura: "w-[22%]", campo: "status" },
  { rotulo: "Responsável", largura: "w-[18%]", campo: "responsavel" },
  { rotulo: "Criticidade", largura: "w-[10%]", campo: "criticidade" },
  { rotulo: "Prazo", largura: "w-[14%]", campo: "prazo" },
];

function LegendaStatus() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3.5 px-7 pt-3 pb-1 text-[11.5px] text-muted-foreground">
      <strong className="font-semibold text-foreground">
        Legenda de status:
      </strong>
      {ORDEM_STATUS.map((status) => (
        <span key={status} className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className={cn(
              "size-2 rounded-full",
              COR_STATUS_BADGE[status].split(" ")[0],
            )}
          />
          {LABEL_STATUS[status]}
        </span>
      ))}
    </div>
  );
}

function LinhaEsqueleto() {
  return (
    <tr className="border-b border-border">
      {COLUNAS.map((coluna) => (
        <td key={coluna.rotulo} className="p-3">
          <Skeleton className="h-4 w-24" />
        </td>
      ))}
    </tr>
  );
}

function ResponsavelCelula({ documento }: { documento: DocumentoUnidade }) {
  const principal = responsavelPrincipal(documento);

  if (!principal) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          —
        </div>
        <span className="truncate text-muted-foreground">Sem responsável</span>
      </div>
    );
  }

  const nome = nomeExibicao(principal.usuario);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
        {iniciaisDe(nome)}
      </div>
      <span className="truncate">{nome}</span>
    </div>
  );
}

export function MatrizTable({
  documentos,
  carregandoPrimeiraVez,
  ordenacao,
  onOrdenar,
  refTabela,
  maxHeight,
  onClickLinha,
}: MatrizTableProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-7 pb-7">
      {/* Mesmo padrão de GerenciarUsuarios.tsx (Administração): a borda
          fica no wrapper rolável, travado em maxHeight (múltiplo exato de
          linhas -- useAlturaSemLinhaCortada), não na <table> em si. Isso é
          o que resolve o espaço vazio "solto" abaixo da tabela quando tem
          poucas linhas: a caixa com borda sempre ocupa o mesmo tamanho
          (rola por dentro se sobrar conteúdo), a legenda vem logo depois
          dela, nunca grudada no fim da tela.

          Duas camadas, não uma só: `rounded-lg`+`overflow-auto` no MESMO
          elemento que tem um filho `sticky` (o <thead> abaixo) deixa o
          canto arredondado "vazar" em alguns navegadores -- o recorte
          visual (moldura arredondada, sem scroll) fica no de fora; quem
          rola de verdade é o de dentro, sem raio de borda próprio, então
          não tem canto nenhum pra vazar. */}
      <div
        style={{ maxHeight }}
        className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card"
      >
        <div
          ref={refTabela}
          className="scrollbar-discreta scroll-fade-x h-full min-w-0 overflow-auto"
        >
          {/* min-w-[820px] (mesma técnica de GerenciarUsuarios.tsx, na
              Administração): sem isso, table-fixed com colunas em % vira
              fatia ilegível em telas estreitas (largura da própria tela
              dividida por 6). Com um mínimo, é a CAIXA que rola de lado
              (scroll-fade-x acima já cuidava disso, só faltava ter o que
              rolar) -- cada coluna sempre tem espaço decente pro conteúdo,
              não fica achatada. */}
          <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => {
                  const ativa = ordenacao?.campo === coluna.campo;
                  const Icone = !ativa
                    ? ArrowUpDown
                    : ordenacao.direcao === "asc"
                      ? ArrowUp
                      : ArrowDown;
                  return (
                    <th
                      key={coluna.rotulo}
                      className={cn(
                        "sticky top-0 border-b border-border bg-muted px-4 py-2.5 text-left text-[13px] font-bold tracking-wide text-muted-foreground uppercase",
                        coluna.largura,
                      )}
                    >
                      {/* opacity-70 (era 40) + hover:opacity-100: achado no
                          review visual -- o ícone quase invisível nas
                          colunas inativas não deixava claro que o
                          cabeçalho é clicável. */}
                      <button
                        type="button"
                        onClick={() => onOrdenar(coluna.campo)}
                        className={cn(
                          "group flex items-center gap-1 hover:text-foreground",
                          ativa && "text-foreground",
                        )}
                      >
                        {coluna.rotulo}
                        <Icone
                          className={cn(
                            "size-3",
                            !ativa && "opacity-70 group-hover:opacity-100",
                          )}
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
                  <LinhaEsqueleto key={indice} />
                ))
              ) : documentos.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <FileX2 className="size-8" />
                      <span className="text-sm font-medium">
                        Nenhum documento encontrado
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                documentos.map((documento) => {
                  const prazo = prazoDocumento(documento);
                  return (
                    <tr
                      key={documento.id}
                      onClick={() => onClickLinha?.(documento)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/5"
                    >
                      <td className="truncate px-4 py-3 text-sm font-semibold">
                        {documento.unidade.nome}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="truncate">
                          {documento.tipo_documento.nome}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {LABEL_CATEGORIA[documento.tipo_documento.categoria]}
                        </div>
                      </td>
                      {/* overflow-hidden na célula: rede de segurança contra
                          o badge (nowrap, largura de conteúdo) vazar por
                          cima da coluna vizinha caso a coluna algum dia
                          fique mais estreita que o rótulo mais longo
                          ("Unidade em encerramento") -- achado testando em
                          viewport de celular: sem isso, o badge simplesmente
                          desenhava por cima do texto de Responsável em vez
                          de cortar. truncate no span dá reticências em vez
                          de um corte seco, se chegar a esse limite. */}
                      <td className="overflow-hidden px-4 py-3">
                        <span
                          className={cn(
                            // inline-block (não inline-flex) de propósito:
                            // text-overflow:ellipsis não funciona de forma
                            // confiável dentro de um container flex (a
                            // reticência simplesmente não aparecia, cortava
                            // seco) -- esse badge não tem ícone/bolinha, só
                            // texto, então inline-block resolve sem perder
                            // nada visualmente.
                            "inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase",
                            COR_STATUS_BADGE[documento.status],
                          )}
                        >
                          {LABEL_STATUS[documento.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <ResponsavelCelula documento={documento} />
                      </td>
                      <td className="px-4 py-3">
                        {documento.regra_aplicada ? (
                          <span
                            className={cn(
                              "rounded-sm border px-2 py-0.5 text-[11px] font-semibold",
                              documento.regra_aplicada.criticidade === "alta"
                                ? COR_CRITICIDADE_ALTA
                                : "border-border bg-muted text-foreground",
                            )}
                          >
                            {
                              LABEL_CRITICIDADE[
                                documento.regra_aplicada.criticidade
                              ]
                            }
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* truncate: achado no code review -- sem isso, um
                          documento vencido há muitos dias ("vencido há 1826
                          dias") podia quebrar em 2 linhas nessa coluna
                          estreita, deixando a linha mais alta que a
                          premissa de useAlturaSemLinhaCortada (altura fixa
                          = 1 linha, medida na primeira). */}
                      <td
                        className={cn(
                          "truncate px-4 py-3 text-[12.5px] font-medium",
                          prazo.urgencia === "vencido" &&
                            "font-semibold text-red-600",
                          prazo.urgencia === "proximo" &&
                            "font-semibold text-amber-700",
                          (prazo.urgencia === "normal" ||
                            prazo.urgencia === "sem-prazo") &&
                            "text-muted-foreground",
                        )}
                      >
                        {prazo.texto}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <LegendaStatus />
    </div>
  );
}
