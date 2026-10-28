"use client";

import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { redesDaLegalizacao } from "@/lib/redes";
import type { Rede } from "@/types";

// A escolha vale para todas as telas da Legalização (Matriz, Mapa,
// Biblioteca e Catálogo) e sobrevive à navegação entre elas.
const CHAVE = "atlas.legalizacao.rede";
const ouvintes = new Set<() => void>();

function lerEscolha(): Rede | null {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return valor === "padrao" || valor === "opex" ? valor : null;
  } catch {
    return null;
  }
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  // Outra aba trocou a rede.
  window.addEventListener("storage", ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener("storage", ouvinte);
  };
}

function guardarEscolha(rede: Rede) {
  try {
    window.localStorage.setItem(CHAVE, rede);
  } catch {
    // Sem localStorage, a escolha não é lembrada, mas a tela continua.
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

/**
 * Rede da Legalização (STC-894). Quem acompanha as duas (Admin Q&G, Gestão
 * de Operações, Setor de Legalização) escolhe; os demais ficam na sua. Uma
 * escolha guardada que não é da pessoa (outro login no mesmo navegador)
 * cai na primeira das dela.
 */
export function useRedeDaLegalizacao() {
  const { redesAdministradas, isSetorLeg, isPontoFocal } = useAuth();
  const redes = redesDaLegalizacao({
    redesAdministradas: redesAdministradas ?? [],
    isSetorLeg: Boolean(isSetorLeg),
    isPontoFocal: Boolean(isPontoFocal),
  });
  const escolha = useSyncExternalStore(assinar, lerEscolha, () => null);
  const rede = escolha && redes.includes(escolha) ? escolha : redes[0];
  return {
    rede,
    redes,
    podeEscolher: redes.length > 1,
    escolherRede: guardarEscolha,
  };
}
