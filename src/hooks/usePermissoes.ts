"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  criarPermissao,
  listarPermissoes,
  reativarPermissao,
  revogarPermissao,
} from "@/lib/plataforma";
import { extrairMensagemErro } from "@/lib/erros";
import type { PermissaoUsuarioPayload } from "@/types";

const CHAVE_LISTA = "permissoes-usuario";

/**
 * Permissões individuais (rota só de Admin Operações). `ativo` falso não
 * busca: sem isso, quem entra na Administração só pelo Catálogo de
 * Legalização tomava 403, e o SWR repetia a busca a cada poucos segundos.
 */
export function usePermissoes(ativo = true) {
  const { data, error, isLoading } = useSWR(ativo ? CHAVE_LISTA : null, listarPermissoes);

  return {
    permissoes: data ?? [],
    isLoading,
    error,
  };
}

export function useCriarPermissao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (_chave, { arg }: { arg: PermissaoUsuarioPayload }) => criarPermissao(arg),
    { onSuccess: () => mutate(CHAVE_LISTA) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useRevogarPermissao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (_chave, { arg }: { arg: number }) => revogarPermissao(arg),
    { onSuccess: () => mutate(CHAVE_LISTA) },
  );

  return {
    revogar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useReativarPermissao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (_chave, { arg }: { arg: number }) => reativarPermissao(arg),
    { onSuccess: () => mutate(CHAVE_LISTA) },
  );

  return {
    reativar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
