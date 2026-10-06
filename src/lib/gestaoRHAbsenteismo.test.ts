import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import api from "./api";
import {
  buscarPainelAbsenteismo,
  formatarPercentual,
  formatarSaldoHoras,
  mesAnteriorFechado,
  textoOcorrencia,
  textoOcorrencias,
  tituloAlerta,
} from "./gestaoRHAbsenteismo";
import {
  absenteismoColaboradorDeExemplo,
  painelAbsenteismoDeExemplo,
  registrarTratamentoDeExemplo,
} from "./gestaoRHAbsenteismoExemplo";
import { textoHistorico } from "./gestaoRHFerias";
import type {
  AlertaAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaAbsenteismo,
} from "@/types/gestaoRH";

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

vi.mock("./api", () => ({ default: { get: vi.fn() } }));

describe("buscarPainelAbsenteismo monta a URL do contrato (STC-588)", () => {
  it("filtros que repetem sem colchetes, booleano como true e sem os vazios", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });

    await buscarPainelAbsenteismo({
      inicio: "2026-09-01",
      fim: "2026-09-30",
      unidade: undefined,
      faixa: ["critica", "atencao"],
      ocorrencia: ["falta"],
      com_pendencias: true,
    });

    const [url, config] = vi.mocked(api.get).mock.calls[0];
    expect(axios.getUri({ ...config, url })).toBe(
      "/modulos/gestao-rh/absenteismo/?inicio=2026-09-01&fim=2026-09-30" +
        "&faixa=critica&faixa=atencao&ocorrencia=falta&com_pendencias=true",
    );
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

function ocorrencia(extra: Partial<OcorrenciaAbsenteismo>): OcorrenciaAbsenteismo {
  return {
    tipo: "falta",
    inicio: "2026-09-04",
    fim: "2026-09-04",
    dias: 1,
    minutos: null,
    conta_no_absenteismo: true,
    em_aprovacao: false,
    justificada: false,
    ...extra,
  };
}

describe("texto das ocorrências da aba", () => {
  it.each<[Partial<OcorrenciaAbsenteismo>, string, string[]]>([
    [{}, "Falta sem justificativa", ["conta no absenteísmo"]],
    [{ justificada: true, em_aprovacao: true }, "Falta com justificativa em aprovação", ["conta no absenteísmo", "em aprovação"]],
    [{ justificada: true }, "Falta justificada", ["conta no absenteísmo"]],
    [{ tipo: "afastamento", fim: "2026-09-05", dias: 2, conta_no_absenteismo: false, justificada: null }, "Afastamento · 2 dias", ["não conta no absenteísmo"]],
    [{ tipo: "atestado", justificada: null }, "Atestado", ["conta no absenteísmo"]],
    [{ tipo: "atraso", dias: null, minutos: 35, conta_no_absenteismo: null, justificada: null }, "Atraso de 35 minutos", ["acima de 15 min"]],
    [{ tipo: "banco_horas", dias: null, minutos: 150, conta_no_absenteismo: false, justificada: null }, "Banco de horas · 2h30", ["não conta no absenteísmo"]],
  ])("%o", (extra, descricao, marcas) => {
    const texto = textoOcorrencia(ocorrencia(extra), 15);
    expect(texto.descricao).toBe(descricao);
    expect(texto.marcas).toEqual(marcas);
  });

  it("período de mais de um dia mostra as duas datas", () => {
    expect(textoOcorrencia(ocorrencia({ fim: "2026-09-05" }), 15).datas).toBe("04/09/2026 a 05/09/2026");
  });
});

describe("título do alerta", () => {
  const base = { periodo_inicio: "2026-08-01", periodo_fim: "2026-08-31" } as AlertaAbsenteismo;

  it("mês fechado: pelo nome do mês", () => {
    expect(tituloAlerta(base)).toBe("Alerta de agosto/2026");
    expect(tituloAlerta({ ...base, periodo_inicio: "2028-02-01", periodo_fim: "2028-02-29" })).toBe(
      "Alerta de fevereiro/2028",
    );
  });

  it("janela de N dias: pelas datas", () => {
    expect(tituloAlerta({ ...base, periodo_inicio: "2026-08-04", periodo_fim: "2026-08-31" })).toBe(
      "Alerta de 04/08/2026 a 31/08/2026",
    );
  });
});

describe("histórico de absenteísmo", () => {
  const registro = { valor_anterior: "", justificativa: "", regra_gatilho: "", por: null, automatico: true, em: "" };
  it.each([
    ["alerta_absenteismo_gerado", "Crítica", "Alerta: faixa crítica"],
    ["tratamento_registrado", "Feedback", "Tratamento registrado: Feedback"],
    ["alerta_absenteismo_encerrado", "", "Alerta encerrado: saiu da faixa na nova carga"],
  ])("%s", (acao, valor_novo, texto) => {
    expect(textoHistorico({ ...registro, acao, valor_novo })).toBe(texto);
  });
});

describe("aba de exemplo (ambiente local)", () => {
  it("bate com o painel e registra o tratamento até recarregar", () => {
    const periodo = { inicio: "2026-09-01", fim: "2026-09-30" };
    const juliana = absenteismoColaboradorDeExemplo(8, periodo);
    expect(juliana.indicadores.percentual).toBe("13.60");
    expect(juliana.alertas).toHaveLength(1);
    expect(juliana.alertas[0].pode_registrar_tratamento).toBe(true);

    const tratada = registrarTratamentoDeExemplo(8, {
      alerta: juliana.alertas[0].id,
      acao: "feedback",
      justificativa: "Conversa.",
    });
    expect(tratada.alertas[0].tratamento?.acao).toBe("feedback");
    expect(tratada.alertas[0].demanda_aberta).toBe(false);
    expect(tratada.historico[0].valor_novo).toBe("Feedback");
  });
});
