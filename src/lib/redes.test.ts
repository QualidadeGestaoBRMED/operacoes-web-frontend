import { describe, expect, it } from "vitest";
import type { Perfil } from "@/types";
import {
  NIVEL_ADMIN_OPERACOES,
  NIVEL_ADMIN_OPERACOES_ESPECIAIS,
  NIVEL_ADMIN_QG,
  NIVEL_GESTAO_OPERACOES,
  NIVEL_PONTO_FOCAL,
  NIVEL_SETOR,
  NIVEL_UNIDADE,
  podeAtribuirCargo,
  podeGerenciar,
  redeDoCargoDeUnidade,
  redesAdministradas,
} from "./redes";

function perfil(nivel: number): Perfil {
  return { id: nivel, nome: `Cargo ${nivel}`, descricao: "", nivel };
}

const CLINICA = { rede: "padrao" as const };
const AERO = { rede: "opex" as const };

describe("redesAdministradas", () => {
  it("usa o que veio da API", () => {
    expect(redesAdministradas({ perfil: perfil(NIVEL_SETOR), redes_administradas: ["opex"] })).toEqual([
      "opex",
    ]);
  });

  it.each([
    [NIVEL_ADMIN_QG, ["opex", "padrao"]],
    [NIVEL_GESTAO_OPERACOES, ["opex", "padrao"]],
    [NIVEL_ADMIN_OPERACOES, ["padrao"]],
    [NIVEL_ADMIN_OPERACOES_ESPECIAIS, ["opex"]],
    [NIVEL_UNIDADE, []],
    [NIVEL_PONTO_FOCAL, []],
  ])("sessão antiga sem o campo: deriva do cargo %i", (nivel, redes) => {
    expect(redesAdministradas({ perfil: perfil(nivel) })).toEqual(redes);
  });

  it("sem usuário ou sem cargo, nenhuma", () => {
    expect(redesAdministradas(undefined)).toEqual([]);
    expect(redesAdministradas({ perfil: null })).toEqual([]);
  });
});

describe("podeAtribuirCargo", () => {
  const go = { perfil: perfil(NIVEL_GESTAO_OPERACOES) };
  const ops = { perfil: perfil(NIVEL_ADMIN_OPERACOES) };

  it("Gestão de Operações atribui os Admins de rede, não Q&G nem o próprio cargo", () => {
    expect(podeAtribuirCargo(go, perfil(NIVEL_ADMIN_OPERACOES))).toBe(true);
    expect(podeAtribuirCargo(go, perfil(NIVEL_ADMIN_OPERACOES_ESPECIAIS))).toBe(true);
    expect(podeAtribuirCargo(go, perfil(NIVEL_GESTAO_OPERACOES))).toBe(false);
    expect(podeAtribuirCargo(go, perfil(NIVEL_ADMIN_QG))).toBe(false);
  });

  it("Admin de rede não atribui cargo administrativo", () => {
    expect(podeAtribuirCargo(ops, perfil(NIVEL_ADMIN_OPERACOES_ESPECIAIS))).toBe(false);
    expect(podeAtribuirCargo(ops, perfil(NIVEL_UNIDADE))).toBe(true);
  });
});

describe("podeGerenciar", () => {
  const ops = { perfil: perfil(NIVEL_ADMIN_OPERACOES) };
  const opex = { perfil: perfil(NIVEL_ADMIN_OPERACOES_ESPECIAIS) };

  it("cada Admin cuida da rede dele, pela unidade ou pelo cargo", () => {
    expect(podeGerenciar(ops, perfil(NIVEL_UNIDADE), CLINICA)).toBe(true);
    expect(podeGerenciar(ops, perfil(NIVEL_PONTO_FOCAL), AERO)).toBe(false);
    expect(podeGerenciar(opex, perfil(NIVEL_PONTO_FOCAL), AERO)).toBe(true);
    // Setor não tem rede: é da rede padrão.
    expect(podeGerenciar(opex, perfil(NIVEL_SETOR), null)).toBe(false);
    expect(podeGerenciar(ops, perfil(NIVEL_SETOR), null)).toBe(true);
  });

  it("recém-chegado sem cargo e sem unidade: qualquer Admin", () => {
    expect(podeGerenciar(opex, null, null)).toBe(true);
    expect(podeGerenciar({ perfil: perfil(NIVEL_UNIDADE) }, null, null)).toBe(false);
  });
});

describe("redeDoCargoDeUnidade", () => {
  it("Unidade é de clínica; Ponto focal, de aeroclínica; os outros não dependem", () => {
    expect(redeDoCargoDeUnidade(perfil(NIVEL_UNIDADE))).toBe("padrao");
    expect(redeDoCargoDeUnidade(perfil(NIVEL_PONTO_FOCAL))).toBe("opex");
    expect(redeDoCargoDeUnidade(perfil(NIVEL_SETOR))).toBeNull();
  });
});
