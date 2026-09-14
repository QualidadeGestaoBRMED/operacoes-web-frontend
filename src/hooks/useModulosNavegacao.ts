"use client";

import { useModulos } from "@/hooks/useModulos";
import { MODULOS_FUTUROS, type ModuloFuturo } from "@/config/modulos-futuros";

export interface ModuloNavegacao extends ModuloFuturo {
  ativo: boolean;
}

// STC-423: cruza o mapeamento local (codigo/rota -- só o que o frontend já
// tem página pronta pra, ver modulos-futuros.ts) com o status real vindo da
// API (Modulo.status). "ativo" exige as duas coisas: rota configurada aqui
// E Modulo.status === "ativo" no backend -- ativar um módulo sem rota
// pronta (ou um módulo que nem existe ainda como Modulo real) nunca destrava
// o link, por decisão da própria issue.
export function useModulosNavegacao(): ModuloNavegacao[] {
  const { modulos } = useModulos();

  return MODULOS_FUTUROS.map((moduloFuturo) => {
    const moduloReal = moduloFuturo.codigo
      ? modulos.find((modulo) => modulo.codigo === moduloFuturo.codigo)
      : undefined;
    return {
      ...moduloFuturo,
      ativo: !!moduloFuturo.rota && moduloReal?.status === "ativo",
    };
  });
}
