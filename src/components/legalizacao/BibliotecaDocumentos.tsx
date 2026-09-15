"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentosLegalizacao, useEvidenciasVigentes } from "@/hooks/useDocumentosLegalizacao";
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
    unidades,
    isLoading: carregandoUnidades,
    error: erroUnidades,
  } = useUnidades();

  useEffect(() => {
    if (unidadeId !== undefined || carregandoUnidades || unidades.length === 0)
      return;
    setUnidadeId(unidades[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoUnidades, unidades]);

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
  const aguardandoValidacaoDeUnidade =
    unidadeId !== undefined && carregandoUnidades;
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

  // Achado numa checagem de falhas críticas: sem isto, uma lista de
  // unidades vazia (zero unidades cadastradas) deixava `unidadeId`
  // indefinido pra sempre -- o efeito que escolhe a 1ª unidade nunca acha
  // pra onde ir, e a tela ficava presa em "Carregando..." eternamente, sem
  // nenhum estado de saída. Diferente da Matriz (onde "nenhuma unidade
  // selecionada" é um estado válido, "todas as unidades"), esta tela exige
  // uma unidade real por design.
  const semUnidadesCadastradas =
    !carregandoUnidades && !erroUnidades && unidades.length === 0;
  const carregandoUnidadeAtual =
    unidadeId === undefined && !erroUnidades && !semUnidadesCadastradas;
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
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-7 py-3">
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
            )}
          >
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
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
                  <div className="flex flex-col">
                    {docsDaCategoria.map((documento) => {
                      const evidencia = evidenciaPorDocumento.get(documento.id);
                      const selecionado = documento.id === documentoSelecionadoId;
                      return (
                        <div
                          key={documento.id}
                          className={cn(
                            "flex items-center gap-3.5 border-b border-border py-3 last:border-b-0",
                            !evidencia && "opacity-60",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white",
                              evidencia ? "bg-red-600" : "bg-muted-foreground",
                            )}
                          >
                            {evidencia ? "PDF" : "!"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {evidencia ? (
                                <button
                                  type="button"
                                  onClick={() => alternarSelecao(documento.id)}
                                  aria-pressed={selecionado}
                                  className={cn(
                                    "truncate text-[13.5px] font-semibold text-foreground hover:text-secondary hover:underline",
                                    selecionado && "text-secondary underline",
                                  )}
                                >
                                  {documento.tipo_documento.nome}
                                </button>
                              ) : (
                                <span className="truncate text-[13.5px] font-semibold text-foreground">
                                  {documento.tipo_documento.nome}
                                </span>
                              )}
                              {!evidencia && (
                                <span
                                  className={cn(
                                    "inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase",
                                    COR_STATUS_BADGE[documento.status],
                                  )}
                                >
                                  {LABEL_STATUS[documento.status]}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {evidencia ? (
                                <>
                                  {prazoDocumento(documento).texto}
                                  {evidencia.emitido_em && (
                                    <> · emitido em {formatarData(evidencia.emitido_em)}</>
                                  )}
                                </>
                              ) : (
                                "Sem evidência vigente cadastrada"
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
                              className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-secondary hover:underline"
                            >
                              <Download className="size-3.5" />
                              PDF
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
              (todo navegador moderno renderiza PDF nativamente assim) --
              não um esboço estático como no mockup. */}
          {documentoSelecionado && evidenciaSelecionada && (
            <aside className="flex w-full shrink-0 flex-col border-border sm:w-[380px] sm:border-l">
              <div className="flex items-start justify-between gap-2.5 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {documentoSelecionado.tipo_documento.nome}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {evidenciaSelecionada.nome_original}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => setDocumentoSelecionadoId(null)}
                  aria-label="Fechar pré-visualização"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 bg-muted/30">
                <iframe
                  title={`Pré-visualização de ${evidenciaSelecionada.nome_original}`}
                  src={urlAbsolutaDaEvidencia(evidenciaSelecionada.arquivo)}
                  className="size-full border-0"
                />
              </div>
              <div className="border-t border-border px-5 py-3.5">
                <a
                  href={urlAbsolutaDaEvidencia(evidenciaSelecionada.arquivo)}
                  target="_blank"
                  rel="noreferrer"
                  download={evidenciaSelecionada.nome_original}
                >
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5">
                    <Download className="size-3.5" />
                    Baixar PDF
                  </Button>
                </a>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
