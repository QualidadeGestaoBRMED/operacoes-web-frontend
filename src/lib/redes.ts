import type { Perfil, Rede, Unidade } from "@/types";

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

/** Rede de uma unidade; sem unidade (demanda Operacional), a padrão. */
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
