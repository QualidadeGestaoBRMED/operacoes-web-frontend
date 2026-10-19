"use client";

import { useSyncExternalStore } from "react";

/**
 * "Ver como" (STC-790): o Admin Q&G vê o Atlas como outro usuário, só para
 * leitura. O backend (STC-789) responde cada requisição como a pessoa
 * quando ela leva o id da sessão no cabeçalho X-Ver-Como (src/lib/api.ts).
 *
 * A sessão fica no sessionStorage: vale só nesta aba (outra aba aberta do
 * zero abre como o Admin, sem a faixa) e não passa da validade: vencida,
 * some ao ser lida.
 */

export interface SessaoVerComo {
  id: string;
  usuario: { id: number; nome: string };
  admin: { id: number; nome: string };
  iniciada_em: string;
  expira_em: string;
}

export const CABECALHO_VER_COMO = "X-Ver-Como";
export const MENSAGEM_SOMENTE_LEITURA =
  "Somente leitura no modo ver como: saia do ver como para fazer alterações.";
// Recusas do backend que encerram o "ver como" na tela (plataforma/ver_como.py).
export const CODIGOS_DE_FIM = ["ver_como_encerrado", "ver_como_invalido"];
export const CODIGO_SOMENTE_LEITURA = "ver_como_somente_leitura";

const CHAVE = "atlas.verComo";
const CHAVE_AVISO = "atlas.verComoAviso";

let bruto: string | null = null;
let cache: SessaoVerComo | null = null;

function ler(): string | null {
  try {
    return window.sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Sessão em andamento nesta aba, ou null (nenhuma, ou vencida). */
export function sessaoVerComo(): SessaoVerComo | null {
  if (typeof window === "undefined") return null;
  const atual = ler();
  if (atual !== bruto) {
    bruto = atual;
    try {
      cache = atual ? (JSON.parse(atual) as SessaoVerComo) : null;
    } catch {
      cache = null;
    }
  }
  if (cache && Date.parse(cache.expira_em) <= Date.now()) {
    limparVerComo();
    return null;
  }
  return cache;
}

export function guardarVerComo(sessao: SessaoVerComo) {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // Sem sessionStorage (navegação privada restrita), o "ver como" não começa.
  }
}

export function limparVerComo() {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // nada a limpar
  }
  bruto = null;
  cache = null;
}

/** Aviso para a próxima carga da página (o "ver como" terminou sozinho). */
export function avisarFimDoVerComo(mensagem: string) {
  try {
    window.sessionStorage.setItem(CHAVE_AVISO, mensagem);
  } catch {
    // sem aviso
  }
}

export function lerAvisoDeFim(): string | null {
  try {
    const aviso = window.sessionStorage.getItem(CHAVE_AVISO);
    window.sessionStorage.removeItem(CHAVE_AVISO);
    return aviso;
  } catch {
    return null;
  }
}

/** Termina o "ver como" nesta aba e recarrega a página como o Admin. */
export function sairDoVerComo(destino: string, aviso?: string) {
  limparVerComo();
  if (aviso) avisarFimDoVerComo(aviso);
  window.location.assign(destino);
}

const nadaMuda = () => () => {};

/** A sessão desta aba para a tela. Muda só com recarga da página (começar e
 * sair do "ver como" recarregam), então não há o que ouvir. No servidor e
 * na hidratação, null. */
export function useVerComo(): SessaoVerComo | null {
  return useSyncExternalStore(nadaMuda, sessaoVerComo, () => null);
}
