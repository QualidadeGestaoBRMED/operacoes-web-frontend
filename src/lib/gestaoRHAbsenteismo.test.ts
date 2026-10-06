import axios from "axios";
import { describe, expect, it } from "vitest";
import {
  formatarPercentual,
  formatarSaldoHoras,
  mesAnteriorFechado,
  textoOcorrencias,
} from "./gestaoRHAbsenteismo";
import { painelAbsenteismoDeExemplo } from "./gestaoRHAbsenteismoExemplo";
import type { LinhaPainelAbsenteismo } from "@/types/gestaoRH";

describe("período padrão: mês anterior fechado", () => {
  it.each([
    ["2026-10-06", "2026-09-01", "2026-09-30"],
    ["2026-01-15", "2025-12-01", "2025-12-31"],
    ["2028-03-01", "2028-02-01", "2028-02-29"],
  ])("hoje %s → %s a %s", (hoje, inicio, fim) => {
    expect(mesAnteriorFechado(hoje)).toEqual({ inicio, fim });
  });
});

describe("formatação", () => {
  it("percentual em pt-BR com até uma casa, e traço sem dado", () => {
    expect(formatarPercentual("13.60")).toBe("13,6%");
    expect(formatarPercentual("10.00")).toBe("10%");
    expect(formatarPercentual(null)).toBe("—");
  });

  it("saldo do banco de horas com sinal", () => {
    expect(formatarSaldoHoras(-220)).toBe("-03:40");
    expect(formatarSaldoHoras(250)).toBe("+04:10");
    expect(formatarSaldoHoras(0)).toBe("00:00");
  });

  it("ocorrências só com o que aconteceu, no singular e no plural", () => {
    const base = { faltas: 2, atestados: 1, atrasos_acima_do_limite: 0, saidas_acima_do_limite: 1 };
    expect(textoOcorrencias(base as LinhaPainelAbsenteismo)).toEqual({
      ausencias: "2 faltas · 1 atestado",
      jornada: "1 saída antecipada",
    });
    expect(
      textoOcorrencias({ faltas: 0, atestados: 0, atrasos_acima_do_limite: 0, saidas_acima_do_limite: 0 } as LinhaPainelAbsenteismo),
    ).toEqual({ ausencias: null, jornada: null });
  });
});

describe("filtros que repetem vão no formato do DRF", () => {
  it("faixa=critica&faixa=atencao, sem colchetes", () => {
    const uri = axios.getUri({
      url: "/absenteismo/",
      params: { faixa: ["critica", "atencao"], ocorrencia: ["falta"] },
      paramsSerializer: { indexes: null },
    });
    expect(uri).toBe("/absenteismo/?faixa=critica&faixa=atencao&ocorrencia=falta");
  });
});

describe("dados de exemplo seguem o contrato da STC-588", () => {
  const periodo = { inicio: "2026-09-01", fim: "2026-09-30" };

  it("unidade filtra cards e linhas; faixa, ocorrência e pendências só as linhas", () => {
    const todos = painelAbsenteismoDeExemplo(periodo);
    const soCritica = painelAbsenteismoDeExemplo({ ...periodo, faixa: ["critica"] });
    expect(soCritica.linhas.every((linha) => linha.faixa === "critica")).toBe(true);
    expect(soCritica.cards).toEqual(todos.cards);

    const niteroi = painelAbsenteismoDeExemplo({ ...periodo, unidade: 1 });
    expect(niteroi.linhas.every((linha) => linha.colaborador.unidade.id === 1)).toBe(true);
    expect(niteroi.cards.colaboradores).toBe(niteroi.linhas.length);

    const comPendencias = painelAbsenteismoDeExemplo({ ...periodo, com_pendencias: true });
    expect(comPendencias.linhas.every((linha) => linha.pendencias > 0)).toBe(true);
    const comAtraso = painelAbsenteismoDeExemplo({ ...periodo, ocorrencia: ["atraso"] });
    expect(comAtraso.linhas.every((linha) => linha.atrasos_acima_do_limite > 0)).toBe(true);
  });

  it("devolve o período pedido", () => {
    expect(painelAbsenteismoDeExemplo(periodo).periodo).toEqual(periodo);
  });
});
