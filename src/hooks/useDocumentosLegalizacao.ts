"use client";

import { isAxiosError } from "axios";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  adicionarResponsavelLegalizacao,
  atualizarDocumentoLegalizacao,
  comentarNoDocumento,
  desativarDocumentoLegalizacao,
  buscarDocumentoLegalizacao,
  criarDocumentoLegalizacao,
  criarDocumentosLegalizacaoEmLote,
  enviarEvidenciaLegalizacao,
  listarCandidatosResponsaveis,
  listarComentariosDoDocumento,
  listarDocumentosLegalizacao,
  listarEvidenciasVigentes,
  removerResponsavelLegalizacao,
  reverterDocumentoLegalizacao,
} from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type { FonteComentarios } from "./useComentarios";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type {
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
  DocumentoUnidadeLotePayload,
  DocumentoUnidadePayload,
  EvidenciaVigente,
  ResponsavelDocumentoPayload,
} from "@/types/legalizacao";

// Chave raiz usada por toda variação de filtro de useDocumentosLegalizacao
// (["documentos-legalizacao", filtros]) -- mutate() com este prefixo
// (predicate abaixo) invalida TODAS as combinações de filtro já em cache de
// uma vez, sem precisar saber qual filtro cada tela está usando agora.
const PREFIXO_CHAVE_LISTA = "documentos-legalizacao";

// Exportado -- outras mutações que também mudam o status de um documento
// (ex.: useCriarProcessoRenovacao, useProcessoRenovacao.ts) precisam
// invalidar a mesma lista, e reimplementar o predicate correndo o risco de
// desalinhar do PREFIXO_CHAVE_LISTA real se um dos dois mudar sozinho.
export function ehChaveDeListaDeDocumentos(chave: unknown) {
  return Array.isArray(chave) && chave[0] === PREFIXO_CHAVE_LISTA;
}

// Diferente de useDemandas.ts (10s, MP001) de propósito -- achado na STC-378:
// documento regulatório muda de status raras vezes (não é um board vivo com
// gente arrastando card o tempo todo), então não se justifica o mesmo custo
// de polling agressivo. 60s reduz as chamadas em 6x sem perder nada de
// prático -- ninguém precisa saber que um alvará venceu com 10s de atraso.
const INTERVALO_POLL_MS = 60_000;

export function useDocumentosLegalizacao(
  filtros?: DocumentoUnidadeFiltros,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  // keepPreviousData/desabilitado: mesmo motivo de useDemandas.ts -- evita
  // a lista colapsar pra "carregando" a cada troca de filtro, e evita
  // mostrar um resultado sem filtro nenhum antes da 1ª consulta de verdade
  // resolver, quando desabilitado por alguma dependência ainda não pronta.
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    DocumentoUnidade[]
  >(
    opcoes?.desabilitado ? null : ["documentos-legalizacao", filtros],
    () => listarDocumentosLegalizacao(filtros),
    {
      keepPreviousData: true,
      refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS,
    },
  );
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, isValidating);

  return {
    documentos: data ?? [],
    isLoading,
    isValidating,
    isFilterChangeValidating: trocandoFiltro,
    carregandoPrimeiraVez: data === undefined,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

// STC-416 (Biblioteca de Documentos): endpoint agregado, uma linha por
// documento com evidência vigente na unidade -- mesmo poll de 60s dos
// outros hooks deste módulo, documento regulatório não muda rápido o
// suficiente pra justificar algo mais agressivo.
export function useEvidenciasVigentes(unidadeId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<EvidenciaVigente[]>(
    unidadeId ? ["evidencias-vigentes", unidadeId] : null,
    () => listarEvidenciasVigentes(unidadeId as number),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  return {
    evidencias: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useDocumentoLegalizacao(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<DocumentoUnidade>(
    id ? ["documento-legalizacao", id] : null,
    () => buscarDocumentoLegalizacao(id as number),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  return {
    documento: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useCriarDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-documento-legalizacao",
    (_chave, { arg }: { arg: DocumentoUnidadePayload }) =>
      criarDocumentoLegalizacao(arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useCriarDocumentosLegalizacaoEmLote() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-documentos-legalizacao-em-lote",
    (_chave, { arg }: { arg: DocumentoUnidadeLotePayload }) =>
      criarDocumentosLegalizacaoEmLote(arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// Lista de processos de UM documento (aba Protocolo e modal de renovação).
export function chaveProcessosDoDocumento(documentoId: number) {
  return ["processos-renovacao", documentoId] as const;
}

const PREFIXOS_DO_KANBAN = new Set(["demandas", "demanda", "resumo-demandas"]);

function ehChaveDoKanban(chave: unknown) {
  const prefixo = Array.isArray(chave) ? chave[0] : chave;
  return typeof prefixo === "string" && PREFIXOS_DO_KANBAN.has(prefixo);
}

// PATCH parcial do documento: o "Editar" do detalhe (status, validade,
// identificador) e a `regra_aplicada` depois de uma nova versão de regra
// (FormNovaVersaoRegra.tsx).
export function useAtualizarDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "atualizar-documento-legalizacao",
    (
      _chave,
      {
        arg,
      }: { arg: { id: number; payload: Partial<DocumentoUnidadePayload> } },
    ) => atualizarDocumentoLegalizacao(arg.id, arg.payload),
    {
      onSuccess: (documento) => {
        void mutate(ehChaveDeListaDeDocumentos);
        // STC-833: Regular à mão concluiu a renovação aberta (card em
        // Concluído), ou Em andamento/Protocolado abriu uma (card novo).
        if (documento.renovacao_concluida_junto || documento.renovacao_aberta_junto) {
          void mutate(chaveProcessosDoDocumento(documento.id));
          void mutate(ehChaveDoKanban);
        }
      },
    },
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// Sem payload (STC-430) -- o backend recalcula o destino sozinho pela
// validade já registrada, sem exigir justificativa.
export function useReverterDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "reverter-documento-legalizacao",
    (_chave, { arg }: { arg: { id: number } }) =>
      reverterDocumentoLegalizacao(arg.id),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    reverter: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// Telas que mostram algo que sai de cena com o documento desativado (STC-853): Matriz e
// mapa (lista de documentos), Biblioteca (evidências vigentes), Kanban (card
// do processo de renovação) e os avisos (alertas e notificações do documento).
const PREFIXOS_AFETADOS_PELA_DESATIVACAO = new Set([
  PREFIXO_CHAVE_LISTA,
  "evidencias-vigentes",
  "demandas",
  "demanda",
  "resumo-demandas",
  "alertas-pendentes",
  "notificacoes",
  "notificacoes-nao-lidas",
]);

export function ehChaveAfetadaPelaDesativacao(chave: unknown) {
  const prefixo = Array.isArray(chave) ? chave[0] : chave;
  return typeof prefixo === "string" && PREFIXOS_AFETADOS_PELA_DESATIVACAO.has(prefixo);
}

export function useDesativarDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "desativar-documento-legalizacao",
    async (_chave, { arg }: { arg: { id: number; justificativa: string } }) => {
      try {
        await desativarDocumentoLegalizacao(arg.id, arg.justificativa);
        return { id: arg.id, jaDesativado: false };
      } catch (erro) {
        // 404: outra pessoa desativou antes. O resultado é o mesmo (o
        // documento sai de cena), então as telas são atualizadas igual.
        if (isAxiosError(erro) && erro.response?.status === 404) {
          return { id: arg.id, jaDesativado: true };
        }
        throw erro;
      }
    },
    {
      onSuccess: ({ id }) => {
        // O detalhe do documento desativado não é buscado de novo (daria 404).
        void mutate(["documento-legalizacao", id], undefined, { revalidate: false });
        void mutate(ehChaveAfetadaPelaDesativacao);
      },
    },
  );

  return {
    desativar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// STC-516/STC-517: candidatos a responsável operacional -- reage a
// unidade/tipo_documento escolhidos no formulário (mesmo padrão de chave
// composta de useEvidenciasVigentes acima). Desabilitado (chave null) até
// os dois estarem escolhidos -- não faz sentido perguntar candidatos sem
// unidade+tipo, e o próprio endpoint exige os dois.
export function useCandidatosResponsaveis(
  unidadeId: number | undefined,
  tipoDocumentoId: number | undefined,
) {
  const { data, error, isLoading, mutate } = useSWR(
    unidadeId && tipoDocumentoId
      ? ["candidatos-responsaveis", unidadeId, tipoDocumentoId]
      : null,
    () => listarCandidatosResponsaveis(unidadeId as number, tipoDocumentoId as number),
  );

  return {
    candidatos: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    tentarNovamente: () => void mutate(),
  };
}

export function useEnviarEvidenciaLegalizacao(documentoId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["documento-legalizacao", documentoId, "evidencias"],
    (_chave, { arg }: { arg: File }) =>
      enviarEvidenciaLegalizacao(documentoId, arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    enviar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// STC-518: editar responsável de um documento já cadastrado
// (DetalheDocumentoModal.tsx) -- endpoint já existia no backend, sem
// cliente/hook no frontend. Só invalida a lista aqui (mesmo padrão dos
// outros hooks de mutação deste arquivo); quem chama (o modal) já mantém
// seu próprio `mutate()` do documento específico via useDocumentoLegalizacao.
export function useAdicionarResponsavelLegalizacao(documentoId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["documento-legalizacao", documentoId, "responsaveis", "adicionar"],
    (_chave, { arg }: { arg: ResponsavelDocumentoPayload }) =>
      adicionarResponsavelLegalizacao(documentoId, arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    adicionar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useRemoverResponsavelLegalizacao(documentoId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["documento-legalizacao", documentoId, "responsaveis", "remover"],
    (_chave, { arg }: { arg: number }) =>
      removerResponsavelLegalizacao(documentoId, arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    remover: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// STC-804: os comentários do documento, no mesmo feed do Kanban
// (ComentarioFeed). A aba Comentários e o botão do modal de renovação usam a
// mesma chave: comentar num atualiza a contagem do outro.
export function fonteDoDocumento(documentoId: number): FonteComentarios {
  return {
    chave: ["documento-legalizacao", documentoId, "comentarios"],
    listar: () => listarComentariosDoDocumento(documentoId),
    criar: (texto) => comentarNoDocumento(documentoId, texto),
  };
}
