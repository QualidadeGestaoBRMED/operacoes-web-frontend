"use client";

import useSWR, { mutate as mutateGlobal } from "swr";
import { listarEvidenciasLegalizacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type { EvidenciaRegulatoria } from "@/types/legalizacao";

export function useEvidenciasLegalizacao(documentoId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<EvidenciaRegulatoria[]>(
    documentoId ? ["documento-legalizacao", documentoId, "evidencias"] : null,
    () => listarEvidenciasLegalizacao(documentoId as number),
  );

  return {
    evidencias: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

// STC-511: reabrir um documento já visto na Biblioteca de Documentos refazia
// o download inteiro do PDF do zero -- o proxy same-origin
// (/api/media/evidencia-vigente) sempre rebaixa o arquivo do R2 de novo, e o
// efeito antigo em BibliotecaDocumentos.tsx revogava a Blob URL a cada troca
// de documento, descartando de propósito os bytes que acabou de baixar.
// Cache em memória (SWR) chaveado por documentoId. revalidateOnFocus/
// revalidateOnReconnect/revalidateIfStale todos false de propósito: uma vez
// baixado, o blob vale pro resto da sessão -- não tem como saber se a
// evidência vigente mudou em paralelo sem rebaixar de novo, o que anularia
// o cache (janela rara, aceita como está, ver issue). A invalidação real é
// manual, via eviction do LRU abaixo.
const CHAVE_PREVIEW = "evidencia-vigente-preview";

// LRU pequeno de propósito -- cada entrada segura um PDF inteiro (Object
// URL) na memória do navegador; sem limite, uma sessão longa abrindo muitos
// documentos diferentes acumularia blobs indefinidamente. Map preserva
// ordem de inserção -- reinserir uma chave (registrarPreviewNoCache) já
// reordena ela pro fim, então o primeiro item (.keys().next()) é sempre o
// menos recentemente carregado.
const TAMANHO_MAXIMO_CACHE_PREVIEW = 8;
const blobUrlsEmCache = new Map<number, string>();

function registrarPreviewNoCache(documentoId: number, blobUrl: string) {
  blobUrlsEmCache.delete(documentoId);
  blobUrlsEmCache.set(documentoId, blobUrl);
  if (blobUrlsEmCache.size <= TAMANHO_MAXIMO_CACHE_PREVIEW) return;
  const idEvictado = blobUrlsEmCache.keys().next().value as number;
  const urlEvictada = blobUrlsEmCache.get(idEvictado);
  blobUrlsEmCache.delete(idEvictado);
  if (urlEvictada) URL.revokeObjectURL(urlEvictada);
  // Limpa o cache do SWR desse documento também -- sem isto, reabri-lo
  // mostraria a Blob URL já revogada (agora inválida) até uma revalidação
  // em segundo plano corrigir, um flash de preview quebrado.
  void mutateGlobal([CHAVE_PREVIEW, idEvictado], undefined, {
    revalidate: false,
  });
}

async function buscarPreviewEvidenciaVigente(documentoId: number) {
  const resposta = await fetch(
    `/api/media/evidencia-vigente?documento=${documentoId}`,
  );
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const blob = await resposta.blob();
  const blobUrl = URL.createObjectURL(blob);
  registrarPreviewNoCache(documentoId, blobUrl);
  return blobUrl;
}

export function useEvidenciaVigentePreview(documentoId: number | null) {
  const { data, error, isLoading } = useSWR<string>(
    documentoId ? [CHAVE_PREVIEW, documentoId] : null,
    () => buscarPreviewEvidenciaVigente(documentoId as number),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return {
    // #toolbar=0&navpanes=0&scrollbar=0 -- parâmetros que o visualizador de
    // PDF nativo do Chrome lê da fragment da URL (mesmo padrão usado no
    // prontuai, front-end/app/checagem/page.tsx). Sem isto, a barra dele
    // (baixar/imprimir/"⋮") aparecia por cima do documento, duplicando o
    // botão "Baixar PDF" do rodapé e destoando do resto da tela. Adicionado
    // aqui (não guardado no cache) -- revogar precisa da Blob URL crua, sem
    // fragment.
    previewUrl: data ? `${data}#toolbar=0&navpanes=0&scrollbar=0` : null,
    carregandoPreview: isLoading,
    erroPreview: error ? "Não foi possível carregar a pré-visualização." : null,
  };
}

// Revoga tudo que sobrou no cache -- chamado no unmount de
// BibliotecaDocumentos (única consumidora hoje). O cache é por sessão/aba de
// propósito (module-level, nunca persistido em storage) -- ao sair da tela,
// os blobs não servem pra mais nada.
export function limparCachePreviewEvidencia() {
  for (const blobUrl of blobUrlsEmCache.values()) URL.revokeObjectURL(blobUrl);
  blobUrlsEmCache.clear();
}
