import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Modulo } from "@/types";
import { useNavegacao } from "./useNavegacao";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {},
    isAdminQG: false,
    isAdminOps: false,
    isCoordenacaoUnidade: false,
    isSetorLeg: false,
  }),
}));

const lista = vi.hoisted(() => ({
  atual: { modulos: [] as Partial<Modulo>[], isLoading: false, error: undefined as unknown },
}));
vi.mock("@/hooks/useModulos", () => ({ useModulos: () => lista.atual }));

function modulo(codigo: string, tem_acesso?: boolean): Partial<Modulo> {
  return { codigo, status: "ativo", ...(tem_acesso === undefined ? {} : { tem_acesso }) };
}

function navegacao() {
  const { modulos, bloqueados } = renderHook(() => useNavegacao()).result.current;
  return { modulos: modulos.map((m) => m.codigo), bloqueados: bloqueados.map((m) => m.nome) };
}

beforeEach(() => {
  lista.atual = { modulos: [], isLoading: false, error: undefined };
});

describe("menu pelo acesso da pessoa (STC-973)", () => {
  it("com acesso a tudo, os três módulos", () => {
    lista.atual.modulos = [
      modulo("gestao-demandas", true),
      modulo("legalizacao", true),
      modulo("gestao-rh", true),
    ];
    expect(navegacao().modulos).toEqual(["gestao-demandas", "legalizacao", "gestao-rh"]);
  });

  it("sem acesso, o módulo some do menu e não vira 'em breve'", () => {
    lista.atual.modulos = [
      modulo("gestao-demandas", true),
      modulo("legalizacao", false),
      modulo("gestao-rh", false),
    ];
    const { modulos, bloqueados } = navegacao();
    expect(modulos).toEqual(["gestao-demandas"]);
    expect(bloqueados).not.toContain("Legalização");
    expect(bloqueados).not.toContain("Gestão RH");
  });

  it("sem acesso ao Kanban, sem Gestão de Demandas", () => {
    lista.atual.modulos = [modulo("gestao-demandas", false), modulo("legalizacao", true)];
    expect(navegacao().modulos).toEqual(["legalizacao"]);
  });

  it("enquanto a lista carrega, nenhum módulo no menu", () => {
    lista.atual = { modulos: [], isLoading: true, error: undefined };
    expect(navegacao()).toEqual({ modulos: [], bloqueados: ["Hub"] });
  });

  it("com a lista falhando, ninguém perde o Gestão de Demandas", () => {
    lista.atual = { modulos: [], isLoading: false, error: new Error("falhou") };
    expect(navegacao().modulos).toEqual(["gestao-demandas"]);
  });

  it("backend sem tem_acesso conta como acesso", () => {
    lista.atual.modulos = [modulo("gestao-demandas"), modulo("legalizacao"), modulo("gestao-rh")];
    expect(navegacao().modulos).toEqual(["gestao-demandas", "legalizacao", "gestao-rh"]);
  });
});

describe("Legalização para quem vê só os próprios documentos (STC-976)", () => {
  function subitensDaLegalizacao() {
    const { modulos } = renderHook(() => useNavegacao()).result.current;
    return modulos.find((m) => m.codigo === "legalizacao")?.subitens.map((s) => s.rota) ?? [];
  }

  it.each(["proprios", "responsavel"] as const)("alcance %s: sem a Biblioteca", (alcance) => {
    lista.atual.modulos = [{ ...modulo("legalizacao", true), alcance }];
    expect(subitensDaLegalizacao()).not.toContain("/modulos/legalizacao/biblioteca");
  });

  it("alcance completo mantém a Biblioteca", () => {
    lista.atual.modulos = [{ ...modulo("legalizacao", true), alcance: "completo" }];
    expect(subitensDaLegalizacao()).toContain("/modulos/legalizacao/biblioteca");
  });
});
