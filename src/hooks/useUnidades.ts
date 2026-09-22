"use client";

import useSWR from "swr";
import { listarUnidades } from "@/lib/plataforma";
import type { Rede, Unidade } from "@/types";

// rede opcional (STC-510, mesmo critério de useSetores): quem já sabe que
// só quer uma rede específica (o caso comum -- "padrao" em toda tela que
// não é de Operações Especiais) escopa a lista; sem ela, cai no
// comportamento antigo (qualquer unidade), usado só por PermissoesAdmin.tsx
// hoje. Rede entra na chave do SWR -- sem isso, as duas variantes
// colidiriam no cache (mesma chave "unidades" pra listas diferentes).
export function useUnidades(rede?: Rede) {
  const { data, error, isLoading } = useSWR<Unidade[]>(["unidades", rede], () =>
    listarUnidades(rede),
  );

  return {
    unidades: data ?? [],
    isLoading,
    error,
  };
}
