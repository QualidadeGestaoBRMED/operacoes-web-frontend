"use client";

import { useSyncExternalStore } from "react";
import type { Rede } from "@/types";

const ouvintes = new Set<() => void>();

function lerEscolha(chave: string): Rede | null {
  try {
    const valor = window.localStorage.getItem(chave);
    return valor === "padrao" || valor === "opex" ? valor : null;
  } catch {
    return null;
  }
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  window.addEventListener("storage", ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener("storage", ouvinte);
  };
}

function guardarEscolha(chave: string, rede: Rede) {
  try {
    window.localStorage.setItem(chave, rede);
  } catch {
    // Sem armazenamento (modo privado restrito): a escolha vale só até
    // recarregar a página.
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

export interface RedeDoModulo {
  rede: Rede;
  redes: Rede[];
  podeEscolher: boolean;
  escolherRede: (rede: Rede) => void;
}

/**
 * Rede escolhida nas telas de um módulo, guardada no navegador em `chave`
 * (uma por módulo). Quem acompanha mais de uma rede escolhe; os demais ficam
 * na sua. Uma escolha guardada que não é da pessoa (outro login no mesmo
 * navegador) cai na primeira de `redes`.
 */
export function useRedeDoModulo(chave: string, redes: Rede[]): RedeDoModulo {
  const escolha = useSyncExternalStore(
    assinar,
    () => lerEscolha(chave),
    () => null,
  );
  const rede = escolha && redes.includes(escolha) ? escolha : redes[0];
  return {
    rede,
    redes,
    podeEscolher: redes.length > 1,
    escolherRede: (nova) => guardarEscolha(chave, nova),
  };
}
