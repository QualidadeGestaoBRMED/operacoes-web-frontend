import type { Perfil, Rede, Unidade, Usuario } from "@/types";

// Cargos (accounts/permissions.py). Os números só identificam o cargo: quem
// administra o quê vem de REDES_POR_NIVEL, nunca de comparar maior/menor
// (STC-745).
export const NIVEL_ADMIN_QG = 1;
export const NIVEL_ADMIN_OPERACOES = 2;
export const NIVEL_UNIDADE = 3;
export const NIVEL_SETOR = 4;
export const NIVEL_PONTO_FOCAL = 5;
export const NIVEL_GESTAO_OPERACOES = 6;
export const NIVEL_ADMIN_OPERACOES_ESPECIAIS = 7;

export const TODAS_AS_REDES: Rede[] = ["opex", "padrao"];

export const ROTULO_REDE: Record<Rede, string> = {
  padrao: "rede própria",
  opex: "Operações Especiais",
};

// Espelha REDES_ADMINISTRADAS do backend. Só é usado quando o usuário não
// traz `redes_administradas` (sessão aberta antes do campo existir: os dados
// do usuário na sessão só são gravados no login).
const REDES_POR_NIVEL: Record<number, Rede[]> = {
  [NIVEL_ADMIN_QG]: TODAS_AS_REDES,
  [NIVEL_GESTAO_OPERACOES]: TODAS_AS_REDES,
  [NIVEL_ADMIN_OPERACOES]: ["padrao"],
  [NIVEL_ADMIN_OPERACOES_ESPECIAIS]: ["opex"],
};

// Quem atribui (ou altera, ativa e desativa) cada cargo administrativo
// (QUEM_ATRIBUI do backend).
const QUEM_ATRIBUI: Record<number, number[]> = {
  [NIVEL_ADMIN_QG]: [NIVEL_ADMIN_QG],
  [NIVEL_GESTAO_OPERACOES]: [NIVEL_ADMIN_QG],
  [NIVEL_ADMIN_OPERACOES]: [NIVEL_ADMIN_QG, NIVEL_GESTAO_OPERACOES],
  [NIVEL_ADMIN_OPERACOES_ESPECIAIS]: [NIVEL_ADMIN_QG, NIVEL_GESTAO_OPERACOES],
};

// Cargos de unidade e a rede que a unidade deles precisa ter.
const REDE_DO_CARGO_DE_UNIDADE: Record<number, Rede> = {
  [NIVEL_UNIDADE]: "padrao",
  [NIVEL_PONTO_FOCAL]: "opex",
};

const CARGOS_DA_REDE_OPEX = [NIVEL_ADMIN_OPERACOES_ESPECIAIS, NIVEL_PONTO_FOCAL];

// O que cada cargo faz, para quem escolhe o cargo na Administração. A
// descrição cadastrada no Perfil (Django Admin), se houver, vale no lugar.
const DESCRICAO_DO_CARGO: Record<number, string> = {
  [NIVEL_ADMIN_QG]: "Administra as duas redes e atribui todos os cargos.",
  [NIVEL_GESTAO_OPERACOES]: "Administra as duas redes e define os Admins de cada rede.",
  [NIVEL_ADMIN_OPERACOES]: "Administra a rede própria: clínicas, setores e configurações.",
  [NIVEL_ADMIN_OPERACOES_ESPECIAIS]: "Administra a rede de Operações Especiais.",
  [NIVEL_UNIDADE]: "Coordenação de uma clínica da rede própria.",
  [NIVEL_SETOR]: "Equipe de um setor de apoio.",
  [NIVEL_PONTO_FOCAL]: "Responsável por uma unidade de Operações Especiais.",
};

export function descricaoDoCargo(perfil: Perfil): string {
  return perfil.descricao.trim() || DESCRICAO_DO_CARGO[perfil.nivel] || "";
}

interface ComCargo {
  perfil?: Perfil | null;
  redes_administradas?: Rede[];
}

export function redesAdministradas(usuario: ComCargo | null | undefined): Rede[] {
  if (!usuario) return [];
  if (usuario.redes_administradas) return usuario.redes_administradas;
  const nivel = usuario.perfil?.nivel;
  return nivel !== undefined ? (REDES_POR_NIVEL[nivel] ?? []) : [];
}

export function administra(usuario: ComCargo | null | undefined, rede: Rede): boolean {
  return redesAdministradas(usuario).includes(rede);
}

/** Redes que a pessoa acompanha na Legalização (STC-894): o Admin, as que
 * administra; o Setor de Legalização, as duas; o Ponto focal, a OPEX; os
 * demais, a rede própria. A padrão vem primeiro. */
export function redesDaLegalizacao(usuario: {
  redesAdministradas: Rede[];
  isSetorLeg: boolean;
  isPontoFocal: boolean;
}): Rede[] {
  const redePropriaPrimeiro: Rede[] = ["padrao", "opex"];
  if (usuario.redesAdministradas.length > 0) {
    return redePropriaPrimeiro.filter((rede) => usuario.redesAdministradas.includes(rede));
  }
  if (usuario.isSetorLeg) return redePropriaPrimeiro;
  return usuario.isPontoFocal ? ["opex"] : ["padrao"];
}

/** Rede de uma unidade; sem unidade (demanda Operacional), a padrão. */
/** Unidade principal e adicionais do usuário (STC-862), sem repetir. */
export function unidadesDoUsuario(
  usuario: Partial<Pick<Usuario, "unidade_id" | "unidades_adicionais_ids">> | null | undefined,
): number[] {
  if (!usuario) return [];
  const ids = [usuario.unidade_id, ...(usuario.unidades_adicionais_ids ?? [])];
  return [...new Set(ids.filter((id): id is number => id != null))];
}

/** Filtro de unidade que a tela da coordenação precisa aplicar, ou null
 * quando o atual já vale. Com uma unidade, sempre ela; com mais de uma,
 * qualquer uma delas ou nenhuma ("todas as minhas", `undefined`). */
export function unidadeForcadaDoCoordenador(
  ehCoordenacao: boolean,
  minhas: number[],
  atual: number | undefined,
): number | undefined | null {
  if (!ehCoordenacao || minhas.length === 0) return null;
  if (minhas.length === 1) return atual === minhas[0] ? null : minhas[0];
  return atual === undefined || minhas.includes(atual) ? null : undefined;
}

/** Filtro de unidade dos painéis: o Admin escolhe entre todas; a
 * coordenação com mais de uma unidade na lista (STC-862), entre as suas.
 * Com uma só na lista, sem filtro: a API já devolve só as dela (o Ponto
 * focal tem unidades OPEX, fora da lista da rede própria). */
export function filtroDeUnidadeDosPaineis<T extends Pick<Unidade, "id">>(
  unidades: T[],
  administraARede: boolean,
  minhas: number[],
): { mostrar: boolean; opcoes: T[]; rotuloTodas: string } {
  if (administraARede) return { mostrar: true, opcoes: unidades, rotuloTodas: "Todas as unidades" };
  const opcoes = unidades.filter((unidade) => minhas.includes(unidade.id));
  return { mostrar: opcoes.length > 1, opcoes, rotuloTodas: "Todas as minhas unidades" };
}

export function redeDaUnidade(unidade: Pick<Unidade, "rede"> | null | undefined): Rede {
  return unidade?.rede ?? "padrao";
}

export function eCargoAdministrativo(perfil: Perfil | null | undefined): boolean {
  return perfil != null && perfil.nivel in QUEM_ATRIBUI;
}

export function podeAtribuirCargo(ator: ComCargo | null | undefined, perfil: Perfil | null) {
  if (!eCargoAdministrativo(perfil)) return true;
  const nivelDoAtor = ator?.perfil?.nivel;
  return nivelDoAtor !== undefined && QUEM_ATRIBUI[perfil!.nivel].includes(nivelDoAtor);
}

/** Rede de um usuário com este cargo e esta unidade (rede_do_usuario do
 * backend): a unidade manda; sem unidade, o cargo; sem os dois, nenhuma. */
export function redeDoUsuario(
  perfil: Perfil | null | undefined,
  unidade: Pick<Unidade, "rede"> | null | undefined,
): Rede | null {
  if (unidade) return unidade.rede;
  if (!perfil) return null;
  return CARGOS_DA_REDE_OPEX.includes(perfil.nivel) ? "opex" : "padrao";
}

/** O ator pode cuidar de um usuário com este cargo e esta unidade
 * (pode_gerenciar do backend). */
export function podeGerenciar(
  ator: ComCargo | null | undefined,
  perfil: Perfil | null | undefined,
  unidade: Pick<Unidade, "rede"> | null | undefined,
): boolean {
  if (eCargoAdministrativo(perfil)) return podeAtribuirCargo(ator, perfil ?? null);
  const rede = redeDoUsuario(perfil, unidade);
  if (rede === null) return redesAdministradas(ator).length > 0;
  return administra(ator, rede);
}

/** Rede que a unidade de um cargo de unidade precisa ter; null para os
 * cargos que não dependem da unidade. */
export function redeDoCargoDeUnidade(perfil: Perfil | null | undefined): Rede | null {
  return perfil ? (REDE_DO_CARGO_DE_UNIDADE[perfil.nivel] ?? null) : null;
}
