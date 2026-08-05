"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { atualizarUsuario, listarUsuarios } from "@/lib/plataforma";
import { extrairMensagemErro } from "@/lib/erros";
import type { Usuario, UsuarioPayload } from "@/types";

const CHAVE_LISTA = "usuarios";

export function useUsuarios() {
  const { data, error, isLoading } = useSWR<Usuario[]>(CHAVE_LISTA, () => listarUsuarios());

  return {
    usuarios: data ?? [],
    isLoading,
    error,
  };
}

export function useAtualizarUsuario() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (_chave, { arg }: { arg: { id: number; payload: UsuarioPayload } }) =>
      atualizarUsuario(arg.id, arg.payload),
    { onSuccess: () => mutate(CHAVE_LISTA) },
  );
  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
