"use client";

import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  listarNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
} from "@/lib/plataforma";
import { extrairMensagemErro } from "@/lib/erros";
import type { Notificacao, RespostaPaginada } from "@/types";

const CHAVE_LISTA = "notificacoes";
const CHAVE_CONTAGEM = "notificacoes-nao-lidas";
// Sem push/WebSocket (fora do escopo do STC-161/169) -- poll periódico é o
// único jeito do sino saber de notificação nova sem o usuário recarregar a
// página. 10s (era 30s) pra bater com o intervalo dos outros dados
// "colaborativos" da STC-206 (comentários, anexos, board etc.).
const INTERVALO_POLL_MS = 10_000;

// A lista (até 20 mais recentes, único recurso paginado de plataforma) e a
// contagem de não lidas (?lida=false, só o "count" importa) são duas chaves
// SWR separadas de propósito: se a contagem viesse só de filtrar a lista
// local, um usuário com mais de 20 notificações acumuladas veria o número
// do sino errado (contando só o que coube na primeira página).
export function useNotificacoes() {
  const { mutate: mutateGlobal } = useSWRConfig();
  const {
    data: lista,
    isLoading,
    error,
  } = useSWR<RespostaPaginada<Notificacao>>(CHAVE_LISTA, () => listarNotificacoes(), {
    refreshInterval: INTERVALO_POLL_MS,
  });
  const { data: naoLidas } = useSWR<RespostaPaginada<Notificacao>>(
    CHAVE_CONTAGEM,
    () => listarNotificacoes({ lida: false }),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  async function revalidarTudo() {
    await Promise.all([mutateGlobal(CHAVE_LISTA), mutateGlobal(CHAVE_CONTAGEM)]);
  }

  async function marcarComoLida(notificacao: Notificacao) {
    if (notificacao.lida) return;

    mutateGlobal(
      CHAVE_LISTA,
      (atual?: RespostaPaginada<Notificacao>) =>
        atual && {
          ...atual,
          results: atual.results.map((item) =>
            item.id === notificacao.id ? { ...item, lida: true } : item,
          ),
        },
      { revalidate: false },
    );
    mutateGlobal(
      CHAVE_CONTAGEM,
      (atual?: RespostaPaginada<Notificacao>) =>
        atual && { ...atual, count: Math.max(0, atual.count - 1) },
      { revalidate: false },
    );

    try {
      await marcarNotificacaoComoLida(notificacao.id);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      void revalidarTudo();
    }
  }

  async function marcarTodasComoLidas() {
    mutateGlobal(
      CHAVE_LISTA,
      (atual?: RespostaPaginada<Notificacao>) =>
        atual && { ...atual, results: atual.results.map((item) => ({ ...item, lida: true })) },
      { revalidate: false },
    );
    mutateGlobal(
      CHAVE_CONTAGEM,
      (atual?: RespostaPaginada<Notificacao>) => atual && { ...atual, count: 0, results: [] },
      { revalidate: false },
    );

    try {
      await marcarTodasNotificacoesComoLidas();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      void revalidarTudo();
    }
  }

  return {
    notificacoes: lista?.results ?? [],
    naoLidasCount: naoLidas?.count ?? 0,
    isLoading,
    error,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
