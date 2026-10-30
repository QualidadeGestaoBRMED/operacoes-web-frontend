import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import api from "./api";
import {
  buscarPainelAbsenteismo,
  composicaoDasAusencias,
  percentualDoTotal,
  textoDoPercentualDoLado,
  diferencaEmPontos,
  ehMesInteiro,
  formatarDiferenca,
  formatarPercentual,
  formatarSaldoHoras,
  limiteDoMensal,
  mesAnteriorFechado,
  mesesPorExtenso,
  nomeCurtoDoMes,
  nomeDoPeriodo,
  periodoAnterior,
  periodoEmAndamento,
  ordenarLinhasAbsenteismo,
  textoOcorrencia,
  textoOcorrencias,
  tituloAlerta,
} from "./gestaoRHAbsenteismo";
import { painelAbsenteismoDeExemplo } from "@/test-utils/painelAbsenteismoExemplo";
import { textoHistorico } from "./gestaoRHFerias";
import type {
  AbsenteismoMensal,
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

describe("comparativo: período anterior", () => {
  it("mês inteiro compara com o mês inteiro anterior", () => {
    expect(periodoAnterior({ inicio: "2026-09-01", fim: "2026-09-30" })).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
    // Março (31 dias) com fevereiro (28 ou 29), não com os 31 dias antes.
    expect(periodoAnterior({ inicio: "2027-03-01", fim: "2027-03-31" })).toEqual({
      inicio: "2027-02-01",
      fim: "2027-02-28",
    });
    expect(periodoAnterior({ inicio: "2028-03-01", fim: "2028-03-31" })).toEqual({
      inicio: "2028-02-01",
      fim: "2028-02-29",
    });
  });

  it("virada de ano", () => {
    expect(periodoAnterior({ inicio: "2027-01-01", fim: "2027-01-31" })).toEqual({
      inicio: "2026-12-01",
      fim: "2026-12-31",
    });
    expect(periodoAnterior({ inicio: "2027-01-01", fim: "2027-01-07" })).toEqual({
      inicio: "2026-12-25",
      fim: "2026-12-31",
    });
  });

  it("outros períodos: o mesmo número de dias logo antes", () => {
    expect(periodoAnterior({ inicio: "2026-10-07", fim: "2026-10-13" })).toEqual({
      inicio: "2026-09-30",
      fim: "2026-10-06",
    });
    // Mês em andamento, até hoje: não é mês inteiro.
    expect(periodoAnterior({ inicio: "2026-10-01", fim: "2026-10-14" })).toEqual({
      inicio: "2026-09-17",
      fim: "2026-09-30",
    });
    expect(periodoAnterior({ inicio: "2026-10-14", fim: "2026-10-14" })).toEqual({
      inicio: "2026-10-13",
      fim: "2026-10-13",
    });
  });

  it("mês inteiro só do dia 1 ao último dia do mesmo mês", () => {
    expect(ehMesInteiro({ inicio: "2026-02-01", fim: "2026-02-28" })).toBe(true);
    expect(ehMesInteiro({ inicio: "2026-09-01", fim: "2026-09-29" })).toBe(false);
    expect(ehMesInteiro({ inicio: "2026-09-02", fim: "2026-09-30" })).toBe(false);
    expect(ehMesInteiro({ inicio: "2026-09-01", fim: "2026-10-31" })).toBe(false);
  });

  it("em andamento enquanto o fim não passou", () => {
    expect(periodoEmAndamento({ inicio: "2026-10-01", fim: "2026-10-31" }, "2026-10-14")).toBe(true);
    expect(periodoEmAndamento({ inicio: "2026-10-01", fim: "2026-10-14" }, "2026-10-14")).toBe(true);
    expect(periodoEmAndamento({ inicio: "2026-09-01", fim: "2026-09-30" }, "2026-10-14")).toBe(false);
  });

  it("nome do período: mês (com o ano só se for outro) ou as datas", () => {
    const setembro = { inicio: "2026-09-01", fim: "2026-09-30" };
    expect(nomeDoPeriodo({ inicio: "2026-08-01", fim: "2026-08-31" }, setembro)).toBe("agosto");
    expect(
      nomeDoPeriodo({ inicio: "2025-12-01", fim: "2025-12-31" }, { inicio: "2026-01-01", fim: "2026-01-31" }),
    ).toBe("dezembro/2025");
    expect(nomeDoPeriodo({ inicio: "2026-09-30", fim: "2026-10-06" }, setembro)).toBe("30/09 a 06/10");
  });

  it("nome curto do mês, sem o ponto da abreviação", () => {
    expect(nomeCurtoDoMes(1)).toBe("jan");
    expect(nomeCurtoDoMes(3)).toBe("mar");
    expect(nomeCurtoDoMes(12)).toBe("dez");
  });

  it("meses por extenso, com três ou mais seguidos agrupados", () => {
    expect(mesesPorExtenso([1, 2, 3, 4, 5, 6, 7, 8])).toBe("jan a ago");
    expect(mesesPorExtenso([1, 2, 3, 4, 5, 6, 7, 8, 11, 12])).toBe("jan a ago, nov e dez");
    expect(mesesPorExtenso([3])).toBe("mar");
    expect(mesesPorExtenso([5, 1, 2])).toBe("jan, fev e mai");
    expect(mesesPorExtenso([])).toBe("");
  });

  it("diferença em pontos, com uma casa, e sem percentual não compara", () => {
    expect(diferencaEmPontos("4.00", "3.60")).toBe(0.4);
    expect(diferencaEmPontos("3.20", "4.85")).toBe(-1.7);
    expect(diferencaEmPontos("3.20", "3.20")).toBe(0);
    expect(diferencaEmPontos("3.20", "3.24")).toBe(0);
    expect(diferencaEmPontos("4.85", "3.20")).toBe(1.7);
    expect(diferencaEmPontos(null, "3.20")).toBeNull();
    expect(diferencaEmPontos("3.20", null)).toBeNull();
    expect(formatarDiferenca(0.4)).toBe("▲ +0,4 p.p.");
    expect(formatarDiferenca(-1.7)).toBe("▼ −1,7 p.p.");
    expect(formatarDiferenca(0)).toBe("sem variação");
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

  it("jornada incompleta (turno variável) junto de atraso e saída", () => {
    const linha = { faltas: 0, atestados: 0, atrasos_acima_do_limite: 1, saidas_acima_do_limite: 0, jornadas_incompletas: 2 };
    expect(textoOcorrencias(linha as LinhaPainelAbsenteismo).jornada).toBe("1 atraso · 2 jornadas incompletas");
    expect(textoOcorrencias({ ...linha, atrasos_acima_do_limite: 0, jornadas_incompletas: 1 } as LinhaPainelAbsenteismo).jornada).toBe(
      "1 jornada incompleta",
    );
  });
});

vi.mock("./api", () => ({ default: { get: vi.fn() } }));

describe("buscarPainelAbsenteismo monta a URL do contrato (STC-588)", () => {
  it("filtros que repetem sem colchetes, booleano como true e sem os vazios", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });

    await buscarPainelAbsenteismo({
      rede: "opex",
      inicio: "2026-09-01",
      fim: "2026-09-30",
      unidade: undefined,
      faixa: ["critica", "atencao"],
      ocorrencia: ["falta"],
      com_pendencias: true,
    });

    const [url, config] = vi.mocked(api.get).mock.calls[0];
    expect(axios.getUri({ ...config, url })).toBe(
      "/modulos/gestao-rh/absenteismo/?rede=opex&inicio=2026-09-01&fim=2026-09-30" +
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
    expect(niteroi.linhas.every((linha) => linha.colaborador.unidade?.id === 1)).toBe(true);
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
    [{ justificada: true, em_aprovacao: true }, "Falta com justificativa", ["conta no absenteísmo", "pendente no VR"]],
    [{ justificada: true }, "Falta justificada", ["conta no absenteísmo"]],
    [{ tipo: "afastamento", fim: "2026-09-05", dias: 2, conta_no_absenteismo: false, justificada: null }, "Afastamento · 2 dias", ["não conta no absenteísmo"]],
    [{ tipo: "atestado", justificada: null }, "Atestado", ["conta no absenteísmo"]],
    [{ tipo: "atraso", dias: null, minutos: 35, conta_no_absenteismo: null, justificada: null }, "Atraso de 35 minutos", ["acima de 15 min"]],
    [{ tipo: "jornada_incompleta", dias: null, minutos: 105, conta_no_absenteismo: null, justificada: null }, "Jornada incompleta de 1h45", ["acima de 15 min"]],
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

describe("ordenação por Unidade", () => {
  it("mistura unidades e equipes do VR pelo texto mostrado na coluna", () => {
    const [base] = painelAbsenteismoDeExemplo({ inicio: "2026-09-01", fim: "2026-09-30" }).linhas;
    const linha = (id: number, unidade: string | null, equipe: string): LinhaPainelAbsenteismo => ({
      ...base,
      colaborador: { ...base.colaborador, id, unidade: unidade ? { id, nome: unidade } : null },
      equipe,
    });
    const linhas = [
      linha(1, "Niterói", "Operações Niterói"),
      linha(2, null, "CAMPANHA - AERO MACAE"),
      linha(3, "Macaé", "Operações Macaé"),
    ];
    const ordenadas = ordenarLinhasAbsenteismo(linhas, { campo: "unidade", direcao: "asc" });
    expect(ordenadas.map((l) => l.colaborador.id)).toEqual([2, 3, 1]);
  });
});

describe("limite do mês a mês (STC-767)", () => {
  function mensal(metasDosMeses: (string | null)[], parametros?: string | null): AbsenteismoMensal {
    const meses = metasDosMeses.map((meta, indice) => ({
      mes: indice + 1,
      inicio: "",
      fim: "",
      futuro: false,
      meta_percentual: meta,
      faixas_cadastradas: true,
      percentual_periodo: "3.00",
      faixa_critica: 0,
      faixa_atencao: 0,
      colaboradores_provisorios: 0,
    }));
    return {
      ano: 2026,
      dados_ate: null,
      meses,
      ...(parametros !== undefined && {
        parametros: { meta_percentual: parametros, faixas_cadastradas: true, vigente_a_partir_de: null },
      }),
    };
  }

  it("usa o limite da versão da resposta, não o do último mês com dado", () => {
    expect(limiteDoMensal(mensal(["5.00", "5.00"], "10.00"))).toBe("10.00");
    expect(limiteDoMensal(mensal(["5.00", "5.00"], null))).toBeNull();
  });

  it("sem `parametros` (backend anterior), o do último mês com dado", () => {
    expect(limiteDoMensal(mensal(["4.00", "5.00"]))).toBe("5.00");
  });

  it("sem resposta, sem limite", () => {
    expect(limiteDoMensal(undefined)).toBeNull();
  });
});

describe("justificado × injustificado (STC-848)", () => {
  it("divide pelos minutos da API, injustificado primeiro, somando 100%", () => {
    expect(composicaoDasAusencias({ minutos_justificados: 480, minutos_injustificados: 960 })).toEqual({
      totalMinutos: 1440,
      partes: [
        { lado: "injustificado", minutos: 960, percentual: 67 },
        { lado: "justificado", minutos: 480, percentual: 33 },
      ],
    });
  });

  it("sem ausência que conte, ou sem os campos (backend anterior), não há composição", () => {
    expect(composicaoDasAusencias({ minutos_justificados: 0, minutos_injustificados: 0 })).toBeNull();
    expect(composicaoDasAusencias({})).toBeNull();
  });

  it("nas pontas não arredonda para 0% nem 100% quando os dois lados têm minutos", () => {
    const composicao = composicaoDasAusencias({ minutos_justificados: 1, minutos_injustificados: 600 });
    const [injustificado, justificado] = composicao!.partes;
    expect(textoDoPercentualDoLado(injustificado, composicao!.totalMinutos)).toBe("mais de 99%");
    expect(textoDoPercentualDoLado(justificado, composicao!.totalMinutos)).toBe("menos de 1%");

    const soInjustificado = composicaoDasAusencias({ minutos_justificados: 0, minutos_injustificados: 60 });
    const [todo, nada] = soInjustificado!.partes;
    expect(textoDoPercentualDoLado(todo, 60)).toBe("100%");
    expect(textoDoPercentualDoLado(nada, 60)).toBe("0%");
  });
});

describe("percentual do total das horas perdidas (STC-868)", () => {
  it("inteiro, com as pontas que o arredondamento esconderia", () => {
    expect(percentualDoTotal(840, 2520)).toBe("33%");
    expect(percentualDoTotal(1, 600)).toBe("menos de 1%");
    expect(percentualDoTotal(599, 600)).toBe("mais de 99%");
    expect(percentualDoTotal(600, 600)).toBe("100%");
    expect(percentualDoTotal(0, 0)).toBe("0%");
    expect(percentualDoTotal(1, 600, true)).toBe("<1%");
    expect(percentualDoTotal(599, 600, true)).toBe(">99%");
  });
});
