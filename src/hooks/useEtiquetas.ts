"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { criarEtiqueta, listarEtiquetas } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { Etiqueta } from "@/types";

// Mesmo padrão de useSetores/useCategorias -- moduloId opcional escopa a
// listagem (STC-197).
export function useEtiquetas(moduloId?: number) {
  const { data, error, isLoading } = useSWR<Etiqueta[]>(["etiquetas", moduloId], () =>
    listarEtiquetas(moduloId),
  );

  return {
    etiquetas: data ?? [],
    isLoading,
    error,
  };
}

function ehChaveDeListaEtiquetas(chave: unknown) {
  return Array.isArray(chave) && chave[0] === "etiquetas";
}

// Restrito a Admin Operações/Admin Q&G no backend (EtiquetaViewSet) -- o
// SeletorEtiquetas só mostra a opção de criar pra quem administra a rede padrão.
export function useCriarEtiqueta() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "etiqueta-nova",
    (_chave, { arg }: { arg: { modulo: number; nome: string; cor: string } }) =>
      criarEtiqueta(arg),
    { onSuccess: () => mutate(ehChaveDeListaEtiquetas) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
