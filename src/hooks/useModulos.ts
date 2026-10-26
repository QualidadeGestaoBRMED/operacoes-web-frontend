"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { listarModulos } from "@/lib/plataforma";
import type { Modulo, RecursoPermissao } from "@/types";

export function useModulos() {
  const { data, error, isLoading, mutate } = useSWR<Modulo[]>("modulos", listarModulos);

  return {
    modulos: data ?? [],
    isLoading,
    error,
    recarregar: mutate,
  };
}

// STC-422: cada recurso vem aninhado dentro do módulo dono dele
// (Modulo.recursos_permissao) -- este hook achata isso numa lista só,
// carregando o id/código/nome do módulo junto em cada item, pra quem
// consome (FormNovaPermissao, PermissoesAdmin) não precisar repetir o
// cruzamento módulo↔recurso toda vez. Reaproveita useModulos() por baixo
// (mesma chave SWR "modulos") -- não é um fetch novo.
export interface RecursoPermissaoComModulo extends RecursoPermissao {
  moduloId: number;
  moduloCodigo: string;
  moduloNome: string;
}

export function useRecursosPermissao() {
  const { modulos, isLoading, error } = useModulos();

  // useMemo (não recalcular em todo render): além de barato, dá uma
  // referência estável pra useEffect em FormNovaPermissao.tsx conseguir
  // reagir de verdade a "o catálogo acabou de chegar", sem refirar em todo
  // render por causa de um array novo a cada vez.
  const recursos = useMemo<RecursoPermissaoComModulo[]>(
    () =>
      modulos.flatMap((modulo) =>
        // Achado em code review: sem o `?? []`, um Modulo que por algum
        // motivo chegasse sem recursos_permissao (contrato quebrado,
        // resposta em cache de uma versão anterior do backend) derrubava a
        // página inteira de Administração com TypeError, não só o
        // catálogo de permissões.
        (modulo.recursos_permissao ?? []).map((recurso) => ({
          ...recurso,
          moduloId: modulo.id,
          moduloCodigo: modulo.codigo,
          moduloNome: modulo.nome,
        })),
      ),
    [modulos],
  );

  return { recursos, isLoading, error };
}

// Compartilhado entre FormNovaPermissao.tsx (resolver moduloId no submit) e
// PermissoesAdmin.tsx (resolver o rótulo pra exibir na tabela) -- um único
// lugar pra decidir o que "recurso não encontrado" significa.
export function encontrarRecursoPorChave(
  recursos: RecursoPermissaoComModulo[],
  chave: string | undefined,
) {
  return recursos.find((recurso) => recurso.chave === chave);
}
