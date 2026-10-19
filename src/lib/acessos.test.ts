import { describe, expect, it } from "vitest";
import type { UsuarioAcesso } from "@/types";
import {
  diasNoPeriodo,
  emDestaque,
  inicioDoPeriodo,
  mesesDoPeriodo,
  rotuloDoUltimoUso,
  rotuloDosDiasSemEntrar,
} from "./acessos";

function usuario(ultimo_uso: string | null, dias_desde_o_ultimo_uso: number | null): UsuarioAcesso {
  return {
    id: 1,
    nome: "Ana",
    email: "ana@exemplo.com",
    perfil: null,
    unidade: null,
    setor: null,
    ultimo_uso,
    dias_desde_o_ultimo_uso,
    dias_com_uso: 0,
    dias: [],
  };
}

describe("acessos (STC-746)", () => {
  it("período termina hoje e conta as duas pontas", () => {
    expect(inicioDoPeriodo(30, "2026-10-19")).toBe("2026-09-20");
    expect(inicioDoPeriodo(365, "2026-10-19")).toBe("2025-10-20");
    expect(diasNoPeriodo("2026-09-20", "2026-10-19")).toBe(30);
  });

  it("destaque para quem nunca entrou ou está há 3 dias ou mais sem entrar", () => {
    expect(emDestaque(usuario(null, null))).toBe(true);
    expect(emDestaque(usuario("2026-10-16", 3))).toBe(true);
    expect(emDestaque(usuario("2026-10-17", 2))).toBe(false);
    expect(emDestaque(usuario("2026-10-19", 0))).toBe(false);
  });

  it("rótulos do último uso e dos dias sem entrar", () => {
    expect(rotuloDoUltimoUso(usuario(null, null))).toBe("Nunca entrou");
    expect(rotuloDoUltimoUso(usuario("2026-10-19", 0))).toBe("Hoje");
    expect(rotuloDoUltimoUso(usuario("2026-10-18", 1))).toBe("Ontem");
    expect(rotuloDoUltimoUso(usuario("2026-10-05", 14))).toBe("05/10/2026");
    expect(rotuloDosDiasSemEntrar(usuario("2026-10-19", 0))).toBe("Entrou hoje");
    expect(rotuloDosDiasSemEntrar(usuario("2026-10-18", 1))).toBe("1 dia");
    expect(rotuloDosDiasSemEntrar(usuario("2026-10-05", 14))).toBe("14 dias");
  });

  it("calendário: meses tocados pelo período, virando o ano, com o dia 1 na coluna do dia da semana", () => {
    const meses = mesesDoPeriodo("2025-12-20", "2026-01-10");
    expect(meses.map((mes) => mes.chave)).toEqual(["2025-12", "2026-01"]);
    // 01/12/2025 foi segunda; 01/01/2026, quinta.
    expect(meses.map((mes) => mes.vazias)).toEqual([1, 4]);
    expect(meses[0].dias).toHaveLength(31);
    expect(meses[0].dias.filter((dia) => dia.noPeriodo).map((dia) => dia.numero)).toEqual([
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]);
    expect(meses[1].dias.filter((dia) => dia.noPeriodo)).toHaveLength(10);
    expect(meses[0].rotulo).toBe("dezembro de 2025");
  });
});
