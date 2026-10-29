/**
 * Novidades do Atlas (STC-877): o conteúdo fica em `conteudo/novidades/`,
 * um arquivo por entrada, lido no servidor (`conteudoNovidades.ts`). Aqui
 * ficam as regras que valem no navegador: o que cada pessoa vê, o ponto no
 * menu e a janela de destaque. O backend guarda a mais nova já vista
 * (`ultima_novidade_vista`, STC-876).
 */

import type { Rede } from "@/types";

/** O que o navegador recebe de cada entrada (sem o texto, lido só na página). */
export interface NovidadeResumida {
  /** "AAAA-MM-DD-NN-assunto": data, ordem no dia e assunto. */
  id: string;
  /** "AAAA-MM-DD", tirada do identificador. */
  data: string;
  titulo: string;
  resumo: string;
  /** Códigos dos módulos; vazio: para todos. */
  modulos: string[];
  /** Redes do público (STC-952); vazio: todas. */
  redes: Rede[];
  admin: boolean;
  destaque: boolean;
  imagem: string | null;
  /** Artigo da Ajuda em "Ver como usar" (STC-878). */
  ajuda: string | null;
  /** Tela do recurso, para o botão "Abrir no Atlas" ("/modulos/..."). */
  abrir: string | null;
}

/**
 * Só caminhos do próprio Atlas ("/modulos/..."). "//" e "/\" começam com
 * barra, mas o navegador os lê como outro endereço.
 */
export function ehCaminhoInterno(caminho: string): boolean {
  return /^\/(?![/\\])/.test(caminho);
}

export const FORMATO_DO_IDENTIFICADOR = /^\d{4}-\d{2}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAMANHO_DA_ORDEM = "AAAA-MM-DD-NN".length;

/** A ordem é a da data e do número do dia; o assunto só identifica. */
export function ordem(id: string): string {
  return id.slice(0, TAMANHO_DA_ORDEM);
}

export function maisNovaQue(id: string, vista: string): boolean {
  return ordem(id) > ordem(vista);
}

/** Da mais nova para a mais antiga. */
export function ordenar<T extends { id: string }>(novidades: T[]): T[] {
  return [...novidades].sort((a, b) => (ordem(a.id) < ordem(b.id) ? 1 : ordem(a.id) > ordem(b.id) ? -1 : 0));
}

/** As entradas que a pessoa vê: dos módulos que acessa e das redes em que
 * atua (vazio: todos) e, as de Administração, só quem administra. */
export function visiveisPara<T extends NovidadeResumida>(
  novidades: T[],
  codigosDosModulos: string[],
  administra: boolean,
  redes: Rede[],
): T[] {
  return novidades.filter(
    (novidade) =>
      (!novidade.admin || administra) &&
      (novidade.modulos.length === 0 ||
        novidade.modulos.some((codigo) => codigosDosModulos.includes(codigo))) &&
      (novidade.redes.length === 0 || novidade.redes.some((rede) => redes.includes(rede))),
  );
}

/** Destaque ainda não visto: o mais novo, um de cada vez. */
export function destaquePendente(
  visiveis: NovidadeResumida[],
  ultimaVista: string,
): NovidadeResumida | null {
  return visiveis.find((novidade) => novidade.destaque && maisNovaQue(novidade.id, ultimaVista)) ?? null;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10-26" → "26 de outubro de 2026". */
export function dataPorExtenso(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}
