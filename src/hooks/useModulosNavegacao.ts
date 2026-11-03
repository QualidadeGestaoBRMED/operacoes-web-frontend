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
//
// STC-973: módulo a que a pessoa não tem acesso (`tem_acesso: false`, STC-972)
// sai da lista inteira -- nem link, nem "em breve".
export function useModulosNavegacao(): ModuloNavegacao[] {
  const { modulos } = useModulos();

  return MODULOS_FUTUROS.flatMap((moduloFuturo) => {
    const moduloReal = moduloFuturo.codigo
      ? modulos.find((modulo) => modulo.codigo === moduloFuturo.codigo)
      : undefined;
    if (moduloReal?.tem_acesso === false) return [];
    return [
      {
        ...moduloFuturo,
        ativo: !!moduloFuturo.rota && moduloReal?.status === "ativo",
      },
    ];
  });
}

/**
 * Acesso da pessoa a cada módulo (STC-972). `carregando` enquanto a lista
 * de módulos não chegou: até lá não se sabe o que esconder. Com a lista
 * falhando, ninguém perde o que já via (`temAcesso` dá true).
 */
export function useAcessoAosModulos() {
  const { modulos, isLoading, error } = useModulos();
  return {
    carregando: isLoading && modulos.length === 0 && !error,
    temAcesso: (codigo: string) =>
      modulos.find((modulo) => modulo.codigo === codigo)?.tem_acesso !== false,
  };
}
