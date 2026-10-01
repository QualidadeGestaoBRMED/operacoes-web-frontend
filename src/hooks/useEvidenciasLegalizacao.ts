"use client";

import { useEffect } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";
import { listarEvidenciasLegalizacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { fetchComRenovacao } from "@/lib/renovarSessao";
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

// Achado numa checagem de falhas críticas: abrir um documento e navegar pra
// fora da Biblioteca ANTES do fetch (rebaixar o PDF inteiro do R2) terminar
// deixava o download completar em segundo plano depois de
// limparCachePreviewEvidencia() já ter rodado no unmount -- o Blob criado
// nesse momento nunca era revogado (fica órfão até uma eventual futura
// visita a esta tela desmontar de novo, ou pro resto da aba se o usuário
// não voltar). telaAtiva rastreia se a Biblioteca está montada agora;
// buscarPreviewEvidenciaVigente nem chega a criar o Blob se já desmontou.
let telaAtiva = false;

// Achado no review: reordena a chave pro fim do Map sem mexer no valor --
// chamada tanto no fetch novo (registrarPreviewNoCache abaixo) quanto no
// cache HIT (useEvidenciaVigentePreview, via effect em `data`). Sem isto no
// segundo caso, reabrir um documento já cacheado nunca atualizava sua
// posição no LRU (revalidateIfStale:false faz o SWR devolver o cache sem
// chamar o fetcher, e só o fetcher reordenava) -- um documento recém-visto
// podia ser evictado como se fosse o mais antigo, assim que a sessão abrisse
// mais de TAMANHO_MAXIMO_CACHE_PREVIEW documentos distintos.
function tocarPreviewNoCache(documentoId: number) {
  const blobUrl = blobUrlsEmCache.get(documentoId);
  if (blobUrl === undefined) return;
  blobUrlsEmCache.delete(documentoId);
  blobUrlsEmCache.set(documentoId, blobUrl);
}

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
  // fetchComRenovacao, não fetch puro: com o access expirado, o proxy de mídia
  // devolve 401, e o preview precisa renovar a sessão e repetir -- mesmo fluxo
  // que o interceptor do Axios faz pras outras chamadas (src/lib/api.ts).
  const resposta = await fetchComRenovacao(
    `/api/media/evidencia-vigente?documento=${documentoId}`,
  );
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const blob = await resposta.blob();
  // telaAtiva checado ANTES de criar a Blob URL -- se a Biblioteca já
  // desmontou enquanto o download rodava, nem cria o objeto (nada a
  // revogar depois) e rejeita em vez de resolver, pra não deixar essa
  // Blob URL "boa" presa no cache do SWR como se fosse válida (próxima
  // visita refaz o fetch do zero, mesmo custo de antes desta issue pra
  // esse caso raro).
  if (!telaAtiva) throw new Error("Biblioteca de Documentos desmontada");
  const blobUrl = URL.createObjectURL(blob);
  registrarPreviewNoCache(documentoId, blobUrl);
  return blobUrl;
}

export function useEvidenciaVigentePreview(documentoId: number | null) {
  // Roda uma vez por mount/unmount de BibliotecaDocumentos (este hook é
  // chamado incondicionalmente lá, não só quando um documento está
  // selecionado) -- não precisa de cleanup própria aqui: quem marca
  // telaAtiva de volta pra false é limparCachePreviewEvidencia(), já
  // chamado explicitamente no unmount do componente.
  useEffect(() => {
    telaAtiva = true;
  }, []);

  const { data, error, isLoading, mutate } = useSWR<string>(
    documentoId ? [CHAVE_PREVIEW, documentoId] : null,
    () => buscarPreviewEvidenciaVigente(documentoId as number),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Roda em todo cache HIT também (não só no fetch novo, já coberto dentro
  // de buscarPreviewEvidenciaVigente) -- ver comentário de
  // tocarPreviewNoCache acima.
  useEffect(() => {
    if (documentoId && data) tocarPreviewNoCache(documentoId);
  }, [documentoId, data]);

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
    // STC-511 (review): revalidateIfStale:false (acima) também deixa um
    // ERRO "grudado" no cache -- fechar e reabrir o mesmo documento, mesmo
    // saindo da Biblioteca e voltando, continuaria mostrando o mesmo erro
    // sem tentar de novo. Expõe o mutate() do SWR pra BibliotecaDocumentos.tsx
    // oferecer um "Tentar novamente" explícito, em vez de revalidar sozinho
    // ao reabrir (que arriscaria mascarar uma falha real como se fosse só
    // demora, sem o usuário saber que algo deu errado antes).
    tentarNovamente: () => void mutate(),
  };
}

// Revoga tudo que sobrou no cache -- chamado no unmount de
// BibliotecaDocumentos (única consumidora hoje). O cache é por sessão/aba de
// propósito (module-level, nunca persistido em storage) -- ao sair da tela,
// os blobs não servem pra mais nada.
//
// Limpa o cache do SWR de cada documento também (mesmo motivo do eviction em
// registrarPreviewNoCache) -- o cache do SWR é global, sobrevive ao unmount
// deste componente. Sem isto, voltar pra esta tela depois e reabrir um
// documento já visto antes do unmount devolvia a Blob URL já revogada aqui
// (revalidateIfStale: false não refaz o fetch sozinho), um preview quebrado
// até alguma outra revalidação corrigir.
export function limparCachePreviewEvidencia() {
  telaAtiva = false;
  for (const [documentoId, blobUrl] of blobUrlsEmCache) {
    URL.revokeObjectURL(blobUrl);
    void mutateGlobal([CHAVE_PREVIEW, documentoId], undefined, {
      revalidate: false,
    });
  }
  blobUrlsEmCache.clear();
}
