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
  filtroDeUnidadeDosPaineis,
  redeDoCargoDeUnidade,
  redesAdministradas,
  redesDaLegalizacao,
  unidadeForcadaDoCoordenador,
  unidadesDoUsuario,
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

describe("unidades adicionais (STC-862)", () => {
  it("unidadesDoUsuario junta a principal e as adicionais, sem repetir", () => {
    expect(unidadesDoUsuario({ unidade_id: 1, unidades_adicionais_ids: [2, 1] })).toEqual([1, 2]);
    expect(unidadesDoUsuario({ unidade_id: 1 })).toEqual([1]);
    expect(unidadesDoUsuario({ unidade_id: null })).toEqual([]);
    expect(unidadesDoUsuario(undefined)).toEqual([]);
  });

  it("unidadeForcadaDoCoordenador: com uma unidade, sempre ela; com mais, qualquer uma delas ou todas", () => {
    expect(unidadeForcadaDoCoordenador(true, [1], undefined)).toBe(1);
    expect(unidadeForcadaDoCoordenador(true, [1], 1)).toBeNull();
    expect(unidadeForcadaDoCoordenador(true, [1, 2], undefined)).toBeNull();
    expect(unidadeForcadaDoCoordenador(true, [1, 2], 2)).toBeNull();
    expect(unidadeForcadaDoCoordenador(true, [1, 2], 9)).toBeUndefined();
    expect(unidadeForcadaDoCoordenador(true, [], 9)).toBeNull();
    expect(unidadeForcadaDoCoordenador(false, [1], 9)).toBeNull();
  });

  it("filtroDeUnidadeDosPaineis: Admin escolhe entre todas; coordenação com mais de uma, entre as suas", () => {
    const unidades = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(filtroDeUnidadeDosPaineis(unidades, true, [])).toEqual({
      mostrar: true,
      opcoes: unidades,
      rotuloTodas: "Todas as unidades",
    });
    expect(filtroDeUnidadeDosPaineis(unidades, false, [1, 2])).toEqual({
      mostrar: true,
      opcoes: [{ id: 1 }, { id: 2 }],
      rotuloTodas: "Todas as minhas unidades",
    });
    expect(filtroDeUnidadeDosPaineis(unidades, false, [1]).mostrar).toBe(false);
    // Ponto focal com duas aeroclínicas: nenhuma na lista da rede própria.
    expect(filtroDeUnidadeDosPaineis(unidades, false, [7, 8]).mostrar).toBe(false);
  });
});

describe("redesDaLegalizacao (STC-894)", () => {
  const ninguem = { redesAdministradas: [], isSetorLeg: false, isPontoFocal: false };

  it.each([
    ["Admin das duas redes, a própria primeiro", { ...ninguem, redesAdministradas: ["opex", "padrao"] }, ["padrao", "opex"]],
    ["Admin Operações", { ...ninguem, redesAdministradas: ["padrao"] }, ["padrao"]],
    ["Admin Operações Especiais", { ...ninguem, redesAdministradas: ["opex"] }, ["opex"]],
    ["Setor de Legalização", { ...ninguem, isSetorLeg: true }, ["padrao", "opex"]],
    ["Ponto focal", { ...ninguem, isPontoFocal: true }, ["opex"]],
    ["Coordenador e os demais", ninguem, ["padrao"]],
  ] as const)("%s", (_, usuario, esperado) => {
    expect(redesDaLegalizacao({ ...usuario, redesAdministradas: [...usuario.redesAdministradas] })).toEqual(esperado);
  });
});
