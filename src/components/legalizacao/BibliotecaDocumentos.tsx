"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  FileText,
  FileX,
  MapPin,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentosLegalizacao, useEvidenciasVigentes } from "@/hooks/useDocumentosLegalizacao";
import {
  limparCachePreviewEvidencia,
  useEvidenciaVigentePreview,
} from "@/hooks/useEvidenciasLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { urlAbsolutaDaEvidencia } from "@/lib/legalizacao";
import {
  COR_STATUS_BADGE,
  LABEL_CATEGORIA,
  LABEL_STATUS,
  numeroDaUrl,
  ORDEM_CATEGORIA,
  prazoDocumento,
} from "@/lib/legalizacaoMatriz";
import { cn } from "@/lib/utils";
import type {
  CategoriaDocumento,
  DocumentoUnidade,
  EvidenciaVigente,
} from "@/types/legalizacao";

// "YYYY-MM-DD" -> "DD/MM/AAAA" -- mesmo formatador local de
// DetalheDocumentoModal.tsx, não exportado de lá (um recorte de string, não
// vale a pena compartilhar entre os dois).
function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// prazoDocumento() (legalizacaoMatriz.ts) devolve só "em N dias" pro caso
// futuro -- na Matriz isso aparece dentro de uma coluna chamada "Prazo",
// contexto suficiente; aqui, solto num card, ficava ambíguo (achado no
// feedback visual). "vencido há N dias"/"vence hoje" já têm verbo, não
// precisam de nada a mais.
//
// urgencia "normal" (achado no feedback visual): um prazo longe (ex. 1 ano)
// vira "em 365 dias" -- ninguém pensa em prazo de validade contando dia a
// dia nesse horizonte, só faz sentido a contagem regressiva quando está
// perto (mesmo limiar que já classifica "próximo" vs "normal" na Matriz).
// Longe, a data real é mais clara.
function textoPrazoComVerbo(documento: DocumentoUnidade): string {
  const { texto, urgencia } = prazoDocumento(documento);
  if (urgencia === "normal" && documento.validade) {
    return `Válido até ${formatarData(documento.validade)}`;
  }
  return texto.startsWith("em ") ? `Vence ${texto}` : texto;
}

export function BibliotecaDocumentos() {
  // Mesmo padrão de MatrizConformidade.tsx (unidade/documento na URL) --
  // shareable/refresh-safe. Diferente da Matriz, não existe "todas as
  // unidades" aqui (a issue pede "tela por unidade") -- assim que a lista
  // de unidades carrega, sem nada na URL, cai pra primeira da lista.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [unidadeId, setUnidadeId] = useState<number | undefined>(() =>
    numeroDaUrl(searchParams.get("unidade")),
  );
  const [documentoSelecionadoId, setDocumentoSelecionadoId] = useState<
    number | null
  >(null);

  const {
    user,
    isLoading: carregandoSessao,
    isCoordenacaoUnidade,
  } = useAuth();
  const {
    unidades: todasAsUnidades,
    isLoading: carregandoUnidades,
    error: erroUnidades,
  } = useUnidades("padrao");
  // STC-512: Coordenador só pode ver/selecionar a própria unidade -- o
  // backend já restringe o dado (_documentos_visiveis_para,
  // legalizacao/views.py) a Q(unidade_id=usuario.unidade_id), mas o Select
  // aqui oferecia livremente qualquer unidade da rede, escondendo isso
  // atrás de um "Nenhum documento cadastrado nesta unidade" ao trocar.
  // Filtrar a lista na origem resolve os dois usos abaixo de uma vez só
  // (fallback de auto-seleção e as opções do Select).
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidade.id === user?.unidade_id)
    : todasAsUnidades;

  // carregandoSessao no guard (achado no review): isCoordenacaoUnidade nasce
  // false enquanto a sessão carrega (useAuth.ts) -- sem esperar por ela, a
  // 1ª unidade da REDE INTEIRA (não a do Coordenador) podia ser
  // auto-selecionada e ter seus documentos buscados/exibidos por um
  // instante, antes da sessão resolver e a 2ª correção abaixo consertar.
  useEffect(() => {
    if (
      unidadeId !== undefined ||
      carregandoUnidades ||
      carregandoSessao ||
      unidades.length === 0
    )
      return;
    setUnidadeId(unidades[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoUnidades, carregandoSessao, unidades]);

  // Mesmo achado de code review de MatrizConformidade.tsx: um id de
  // unidade inválido/removida (link antigo, ou editado à mão na URL) não
  // pode travar a tela num filtro fantasma sem nenhuma unidade real
  // correspondente -- cai pra primeira da lista, igual ao caso "nada na
  // URL" acima.
  useEffect(() => {
    if (carregandoUnidades || erroUnidades || unidadeId === undefined) return;
    if (unidades.length === 0 || unidades.some((u) => u.id === unidadeId))
      return;
    setUnidadeId(unidades[0].id);
  }, [carregandoUnidades, erroUnidades, unidades, unidadeId]);

  function mudarUnidade(novoId: number) {
    setUnidadeId(novoId);
    setDocumentoSelecionadoId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("unidade", String(novoId));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Achado em code review (mesma classe de bug já corrigida em
  // MatrizConformidade.tsx): sem pausar, um id de unidade vindo da URL
  // dispara a 1ª busca de documentos/evidências com esse id antes da 2ª
  // validação acima (linhas 79-84) confirmar que ele existe de verdade --
  // se a unidade for inválida, a tela mostra "nenhum documento" por um
  // instante, com o filtro ruim ainda ativo, até o efeito corrigir.
  //
  // carregandoSessao entra aqui também (STC-512, review): um Coordenador
  // chegando com ?unidade=<outra-unidade> na URL (link antigo, de antes
  // desta correção) tem `unidadeId` já definido desde o 1º render -- se
  // `unidades` (useUnidades) resolver ANTES da sessão, a 2ª validação acima
  // ainda enxerga a lista SEM filtro (isCoordenacaoUnidade nasce false
  // enquanto carrega, useAuth.ts) e não corrige nada, liberando a busca com
  // a unidade errada até a sessão resolver e a lista filtrar de verdade.
  const aguardandoValidacaoDeUnidade =
    (unidadeId !== undefined && carregandoUnidades) || carregandoSessao;
  const {
    documentos,
    isLoading: carregandoDocumentos,
    error: erroDocumentos,
    mensagemErro: mensagemErroDocumentos,
  } = useDocumentosLegalizacao(
    unidadeId ? { unidade: unidadeId } : undefined,
    { desabilitado: unidadeId === undefined || aguardandoValidacaoDeUnidade },
  );
  const {
    evidencias,
    isLoading: carregandoEvidencias,
    error: erroEvidencias,
    mensagemErro: mensagemErroEvidencias,
  } = useEvidenciasVigentes(aguardandoValidacaoDeUnidade ? null : (unidadeId ?? null));

  const evidenciaPorDocumento = useMemo(() => {
    const mapa = new Map<number, EvidenciaVigente>();
    evidencias.forEach((evidencia) => mapa.set(evidencia.documento_unidade, evidencia));
    return mapa;
  }, [evidencias]);

  const porCategoria = useMemo(() => {
    const grupos = new Map<CategoriaDocumento, DocumentoUnidade[]>();
    documentos.forEach((documento) => {
      const categoria = documento.tipo_documento.categoria;
      const lista = grupos.get(categoria) ?? [];
      lista.push(documento);
      grupos.set(categoria, lista);
    });
    return ORDEM_CATEGORIA.map((categoria) => ({
      categoria,
      documentos: grupos.get(categoria) ?? [],
    })).filter((grupo) => grupo.documentos.length > 0);
  }, [documentos]);

  const documentoSelecionado =
    documentos.find((d) => d.id === documentoSelecionadoId) ?? null;
  const evidenciaSelecionada = documentoSelecionadoId
    ? evidenciaPorDocumento.get(documentoSelecionadoId)
    : undefined;

  function alternarSelecao(documentoId: number) {
    setDocumentoSelecionadoId((atual) =>
      atual === documentoId ? null : documentoId,
    );
  }

  // Pré-visualização do PDF (useEvidenciaVigentePreview, ver comentários em
  // useEvidenciasLegalizacao.ts). Com R2, o <iframe> abre a URL assinada do
  // PDF direto do bucket: o backend pede `inline` só nessa URL (o download
  // comum continua forçando `attachment`) e a CSP libera o caminho do bucket
  // em frame-src (src/lib/csp.ts). Sem R2 (dev, E2E), os bytes vêm pelo
  // proxy same-origin /api/media/evidencia-vigente e o <iframe> abre uma
  // Blob URL local, cacheada por documento.
  const { previewUrl, carregandoPreview, erroPreview, tentarNovamente } =
    useEvidenciaVigentePreview(documentoSelecionadoId);

  // STC-715: pré-visualização expandida na área de conteúdo inteira. Só
  // esconde a lista e a barra de cima (CSS), sem desmontar nada: o <iframe>
  // continua o mesmo e o PDF não recarrega (a URL assinada do R2 vale 5
  // minutos). O modo vale até a pessoa reduzir, inclusive ao fechar e abrir
  // outro documento; sem o painel na tela (nenhum documento aberto, ou a
  // evidência dele sumiu no poll), a lista e a barra aparecem sempre.
  const [expandido, setExpandido] = useState(false);
  const mostrandoExpandido =
    expandido && documentoSelecionado !== null && evidenciaSelecionada !== undefined;
  // Lista escondida com display:none pode perder a rolagem: guarda a cada
  // rolagem enquanto ela está visível e devolve ao reduzir.
  const refLista = useRef<HTMLDivElement>(null);
  const rolagemDaLista = useRef(0);

  useLayoutEffect(() => {
    if (!mostrandoExpandido && refLista.current) {
      refLista.current.scrollTop = rolagemDaLista.current;
    }
  }, [mostrandoExpandido]);

  useEffect(() => {
    if (!mostrandoExpandido) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      // Com um diálogo aberto por cima (ex.: alerta de documento), o Esc é
      // dele: fecha o diálogo sem reduzir o PDF.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      setExpandido(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mostrandoExpandido]);

  // Só no unmount de verdade (deps vazias) -- os blobs cacheados servem
  // durante toda a visita à tela, não só enquanto um documento específico
  // está selecionado (é justamente o que resolve o re-download ao trocar de
  // documento e voltar). Ao sair da Biblioteca, não servem mais pra nada.
  useEffect(() => {
    return () => limparCachePreviewEvidencia();
  }, []);

  // coordenadorSemUnidade (achado no review, mesmo critério de
  // MatrizConformidade.tsx): Usuario.unidade_id é number|null -- um
  // Coordenador sem unidade vinculada (conta mal configurada,
  // GerenciarUsuarios.tsx não impede) faz `unidades` (filtrado acima)
  // ficar vazio, igual ao caso "rede sem nenhuma unidade cadastrada"
  // (semUnidadesCadastradas, abaixo). Sem distinguir os dois, a mesma
  // mensagem "Nenhuma unidade cadastrada." aparecia pro Coordenador --
  // diagnóstico errado (existem unidades na rede, só nenhuma vinculada à
  // conta dele).
  const coordenadorSemUnidade =
    isCoordenacaoUnidade && !carregandoSessao && !user?.unidade_id;

  // Achado numa checagem de falhas críticas: sem isto, uma lista de
  // unidades vazia (zero unidades cadastradas) deixava `unidadeId`
  // indefinido pra sempre -- o efeito que escolhe a 1ª unidade nunca acha
  // pra onde ir, e a tela ficava presa em "Carregando..." eternamente, sem
  // nenhum estado de saída. Diferente da Matriz (onde "nenhuma unidade
  // selecionada" é um estado válido, "todas as unidades"), esta tela exige
  // uma unidade real por design.
  const semUnidadesCadastradas =
    !coordenadorSemUnidade &&
    !carregandoUnidades &&
    !erroUnidades &&
    unidades.length === 0;
  const carregandoUnidadeAtual =
    unidadeId === undefined &&
    !erroUnidades &&
    !semUnidadesCadastradas &&
    !coordenadorSemUnidade;
  const carregando =
    carregandoUnidadeAtual ||
    aguardandoValidacaoDeUnidade ||
    carregandoDocumentos ||
    carregandoEvidencias;
  const error = erroDocumentos ?? erroEvidencias ?? erroUnidades;
  const mensagemErro =
    mensagemErroDocumentos ??
    mensagemErroEvidencias ??
    (erroUnidades ? extrairMensagemErro(erroUnidades) : null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-border px-7 py-3",
          // Só a partir de sm, como o botão: abaixo dele não há como reduzir.
          mostrandoExpandido && "sm:hidden",
        )}
      >
        <Select
          // "" (nunca undefined) -- achado em code review: alternar entre
          // undefined e uma string definida faz o Radix Select logar
          // "changing from uncontrolled to controlled" assim que a 1ª
          // unidade resolve. String vazia não bate com nenhum SelectItem,
          // então o placeholder aparece igual, sem o aviso.
          value={unidadeId !== undefined ? String(unidadeId) : ""}
          onValueChange={(valor) => mudarUnidade(Number(valor))}
        >
          <SelectTrigger className="w-[220px]" aria-label="Unidade">
            <MapPin className="size-4 text-secondary" />
            <SelectValue placeholder="Selecionar unidade..." />
          </SelectTrigger>
          <SelectContent>
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={String(unidade.id)}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
          Documentos regulatórios vigentes desta unidade, organizados por
          categoria -- só a evidência atual de cada tipo aparece aqui.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5">
        <div className="flex h-full overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div
            ref={refLista}
            onScroll={(evento) => {
              if (!mostrandoExpandido) rolagemDaLista.current = evento.currentTarget.scrollTop;
            }}
            className={cn(
              "scrollbar-discreta min-w-0 flex-1 overflow-y-auto p-6",
              // Achado em code review: sem isto, o painel de pré-
              // visualização (largura fixa) abria do lado da lista em
              // telas estreitas, empurrando tudo pra um scroll horizontal
              // inutilizável -- diferente do Mapa (sem versão mobile por
              // decisão de produto), a lista sozinha funciona bem em
              // celular, só o lado a lado com o preview que não. Em vez de
              // bloquear a tela inteira pra mobile, esconde só a lista
              // enquanto o preview estiver aberto (abaixo de sm: os dois
              // alternam, um de cada vez).
              documentoSelecionado && "hidden sm:block",
              mostrandoExpandido && "sm:hidden",
            )}
          >
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : coordenadorSemUnidade ? (
              <p className="text-sm text-destructive">
                Sua conta não está vinculada a nenhuma unidade -- contate o
                administrador.
              </p>
            ) : semUnidadesCadastradas ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma unidade cadastrada.
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">
                Não foi possível carregar os documentos desta unidade:{" "}
                {mensagemErro}
              </p>
            ) : porCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum documento regulatório cadastrado nesta unidade.
              </p>
            ) : (
              porCategoria.map(({ categoria, documentos: docsDaCategoria }) => (
                <div key={categoria} className="mb-6 last:mb-0">
                  <div className="mb-2.5 flex items-center gap-2 border-b-2 border-secondary pb-2 text-sm font-bold text-foreground">
                    {LABEL_CATEGORIA[categoria]}
                    <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {docsDaCategoria.length}
                    </span>
                  </div>
                  {/* Card por documento (não linha com borda inferior) --
                      mesmo padrão visual de ItemEvidencia em
                      DetalheDocumentoModal.tsx: card com borda arredondada,
                      tingido de verde quando há evidência vigente (mesmo
                      significado -- "vigente" -- que aquele componente já
                      usa), badge de arquivo à esquerda, botão de baixar
                      circular à direita. */}
                  <div className="flex flex-col gap-2">
                    {docsDaCategoria.map((documento) => {
                      const evidencia = evidenciaPorDocumento.get(documento.id);
                      const selecionado = documento.id === documentoSelecionadoId;
                      return (
                        <div
                          key={documento.id}
                          className={cn(
                            "flex items-center gap-3.5 rounded-lg border border-border bg-background p-2.5",
                            // Achado conversando sobre o propósito da tela:
                            // status de workflow (Em andamento, Protocolado,
                            // Não iniciado) não interessa pra quem só vai
                            // mostrar o documento numa fiscalização -- só
                            // Vencido é acionável o bastante pra merecer
                            // destaque, mesmo aqui. Verde só quando tem
                            // arquivo E não está vencido ("documento em
                            // ordem"); vermelho sempre que vencido,
                            // independente de ter um arquivo velho anexado.
                            documento.status === "vencido"
                              ? "border-red-600/40 bg-red-600/5"
                              : evidencia && "border-green-600/40 bg-green-600/5",
                            // Esmaecido (achado em code review: faltava --
                            // critério de aceite da issue pede diferenciação
                            // visual pra documento sem evidência, "por
                            // exemplo esmaecidos"). Só quando não há
                            // evidência E não está vencido -- um vencido sem
                            // evidência continua em destaque total (é o caso
                            // mais acionável de todos, não o contrário).
                            !evidencia && documento.status !== "vencido" && "opacity-60",
                          )}
                        >
                          {/* Ícone de documento, não texto abreviado --
                              achado no feedback visual: "PDF" é redundante
                              (só existe essa extensão neste módulo, STC-429)
                              e "!" sozinho não comunica "sem arquivo". */}
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-md",
                              // Achado em code review: usava só `evidencia`,
                              // deixando o ícone vermelho (cor de "Vencido")
                              // num documento regular em dia -- mesma regra
                              // da borda do card, acima, não uma condição
                              // própria.
                              documento.status === "vencido"
                                ? "bg-red-600"
                                : evidencia
                                  ? "bg-green-600"
                                  : "bg-muted-foreground",
                            )}
                          >
                            {evidencia ? (
                              <FileText className="size-4 text-white" />
                            ) : (
                              <FileX className="size-4 text-white" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {evidencia ? (
                                <button
                                  type="button"
                                  onClick={() => alternarSelecao(documento.id)}
                                  aria-pressed={selecionado}
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-foreground hover:text-secondary hover:underline",
                                    selecionado && "text-secondary underline",
                                  )}
                                >
                                  {documento.tipo_documento.nome}
                                  {/* STC-530: distingue instâncias do mesmo tipo
                                      (ex. várias balanças) -- mesmo padrão já
                                      usado em MatrizTable.tsx. */}
                                  {documento.profissional &&
                                    ` — ${documento.profissional}`}
                                </button>
                              ) : (
                                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                                  {documento.tipo_documento.nome}
                                  {documento.profissional &&
                                    ` — ${documento.profissional}`}
                                </span>
                              )}
                              {/* Só Vencido -- os outros estados de
                                  workflow (Em andamento, Protocolado, Não
                                  iniciado) são internos da Coordenação/
                                  Legalização, não interessam a quem só vai
                                  mostrar o documento numa fiscalização. */}
                              {documento.status === "vencido" && (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase",
                                    COR_STATUS_BADGE[documento.status],
                                  )}
                                >
                                  {LABEL_STATUS[documento.status]}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                              {evidencia ? (
                                <>
                                  {textoPrazoComVerbo(documento)}
                                  {evidencia.emitido_em && (
                                    <> · emitido em {formatarData(evidencia.emitido_em)}</>
                                  )}
                                </>
                              ) : (
                                "Nenhum arquivo cadastrado"
                              )}
                            </p>
                          </div>
                          {evidencia && (
                            <a
                              href={urlAbsolutaDaEvidencia(evidencia.arquivo)}
                              target="_blank"
                              rel="noreferrer"
                              download={evidencia.nome_original}
                              title="Baixar"
                              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Download className="size-4" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Painel de pré-visualização nasce ao lado só quando um
              documento é clicado (achado no refinamento do mockup, Plano de
              Ação - Legalização.md §4, 24/08): sem nada selecionado, a lista
              ocupa a largura toda. Documento real embutido via <iframe>
              (não um esboço estático como no mockup) -- mas apontando pra
              uma Blob URL local (ver useEffect acima), não direto pra URL do
              arquivo: o backend manda X-Frame-Options: DENY em toda
              resposta, então um <iframe src> direto nunca renderizava. */}
          {documentoSelecionado && evidenciaSelecionada && (
            <aside
              // 380px fixo (achado no feedback visual) ficava apertado em
              // desktop -- a página do PDF já saía mais larga que isso,
              // forçando scroll horizontal dentro do próprio preview. clamp()
              // cresce com a tela (até 45% do card) sem depender de mais um
              // breakpoint, mas trava num teto (640px) pra não virar metade
              // da tela em monitor ultrawide; embaixo de sm continua tela
              // cheia, igual antes.
              className={cn(
                "flex w-full shrink-0 flex-col border-border",
                mostrandoExpandido ? "sm:w-full" : "sm:w-[clamp(380px,45%,640px)] sm:border-l",
              )}
            >
              <div className="flex items-start justify-between gap-2.5 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {documentoSelecionado.tipo_documento.nome}
                    {documentoSelecionado.profissional &&
                      ` — ${documentoSelecionado.profissional}`}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {evidenciaSelecionada.nome_original}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Abaixo de sm o painel já ocupa a tela toda. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hidden h-7 gap-1.5 px-2 text-xs sm:inline-flex"
                    onClick={() => setExpandido((atual) => !atual)}
                    title={mostrandoExpandido ? "Reduzir (Esc)" : "Expandir"}
                    aria-expanded={mostrandoExpandido}
                    aria-keyshortcuts={mostrandoExpandido ? "Escape" : undefined}
                  >
                    {mostrandoExpandido ? (
                      <Minimize2 className="size-3.5" />
                    ) : (
                      <Maximize2 className="size-3.5" />
                    )}
                    {mostrandoExpandido ? "Reduzir" : "Expandir"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setDocumentoSelecionadoId(null)}
                    aria-label="Fechar pré-visualização"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30">
                {carregandoPreview ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : erroPreview ? (
                  <div className="flex flex-col items-center gap-2 px-5 text-center">
                    <p className="text-sm text-destructive">{erroPreview}</p>
                    <Button variant="outline" size="sm" onClick={tentarNovamente}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  previewUrl && (
                    <iframe
                      title={`Pré-visualização de ${evidenciaSelecionada.nome_original}`}
                      src={previewUrl}
                      className="size-full border-0"
                    />
                  )
                )}
              </div>
              <div className="border-t border-border px-5 py-3.5">
                {/* asChild (achado em code review): <Button> dentro de <a>
                    gerava dois elementos interativos aninhados no DOM (dois
                    paradas de Tab pra uma ação só, ambíguo pra leitor de
                    tela) -- mesmo padrão já usado em alert-dialog.tsx pra
                    projetar o <a> como a própria raiz interativa. */}
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                  <a
                    href={urlAbsolutaDaEvidencia(evidenciaSelecionada.arquivo)}
                    target="_blank"
                    rel="noreferrer"
                    download={evidenciaSelecionada.nome_original}
                  >
                    <Download className="size-3.5" />
                    Baixar PDF
                  </a>
                </Button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
