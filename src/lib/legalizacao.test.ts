import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertaRegulatorio, ProcessoRenovacao } from "@/types/legalizacao";
import api from "./api";
import {
  alertaAindaRelevante,
  listarAlertasPendentes,
  listarProcessosRenovacao,
} from "./legalizacao";

vi.mock("./api", () => ({
  default: { get: vi.fn() },
}));

const apiGetMock = vi.mocked(api.get);

// Mesmo critério da migration de backend (STC-447) -- defesa em
// profundidade no cliente, não repete ingenuamente "documento resolvido =
// todos os alertas dele somem" (documento Regular pode ter um alerta
// LEGÍTIMO, a varredura diária gera alerta pra documento ainda Regular
// quando a validade entra na janela de antecedência).
function alerta(overrides: Partial<AlertaRegulatorio> = {}): AlertaRegulatorio {
  return {
    id: 1,
    documento_unidade: {
      id: 10,
      tipo_documento: {
        id: 1,
        codigo: "alvara-funcionamento",
        nome: "Alvará de Funcionamento",
        categoria: "regularizacao",
        area_responsavel: "legalizacao",
        abrangencia: "padrao",
        setor_apoio: "",
        exige_validade: true,
        exige_protocolo: false,
        exige_evidencia: true,
        controlado_por_profissional: false,
        permite_multiplas_instancias: false,
        ativo: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      unidade: {
        id: 1,
        nome: "Niterói",
        codigo: "NIT",
        cidade: "Niterói",
        ativa: true,
        rede: "padrao",
      },
      status: "regular",
      justificativa_excecao: "",
      validade: "2026-12-01",
      evidencia_vigente: null,
      regra_aplicada: null,
      responsaveis: [],
      profissional: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    ciclo_referencia: "2026-12-01",
    antecedencia_usada_dias: 60,
    criticidade: "alta",
    imediato: false,
    status_tratamento: "pendente",
    data_geracao: "2026-09-15T12:00:00Z",
    ...overrides,
  };
}

function comDocumento(
  a: AlertaRegulatorio,
  overrides: Partial<AlertaRegulatorio["documento_unidade"]>,
): AlertaRegulatorio {
  return { ...a, documento_unidade: { ...a.documento_unidade, ...overrides } };
}

describe("alertaAindaRelevante (STC-443/STC-447)", () => {
  it("documento vencido/em andamento/protocolado/não iniciado: sempre relevante", () => {
    for (const status of ["vencido", "em_andamento", "protocolado", "nao_iniciado"] as const) {
      expect(alertaAindaRelevante(comDocumento(alerta(), { status }))).toBe(true);
    }
  });

  it("documento não aplicável ou unidade em encerramento: nunca relevante", () => {
    for (const status of ["nao_aplicavel", "unidade_encerramento"] as const) {
      expect(alertaAindaRelevante(comDocumento(alerta(), { status }))).toBe(false);
    }
  });

  it("documento regular, alerta imediato: não é mais relevante (motivo já passou)", () => {
    const a = comDocumento(alerta({ imediato: true }), { status: "regular" });
    expect(alertaAindaRelevante(a)).toBe(false);
  });

  it("documento regular, alerta de ciclo batendo com a validade atual: continua relevante", () => {
    const a = comDocumento(alerta({ ciclo_referencia: "2026-12-01" }), {
      status: "regular",
      validade: "2026-12-01",
    });
    expect(alertaAindaRelevante(a)).toBe(true);
  });

  it("documento regular, alerta de ciclo antigo (documento já renovado): não é mais relevante", () => {
    const a = comDocumento(alerta({ ciclo_referencia: "2026-01-01" }), {
      status: "regular",
      validade: "2026-12-01",
    });
    expect(alertaAindaRelevante(a)).toBe(false);
  });
});

describe("listarAlertasPendentes", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  // Achado em code review: o caminho de 1 página só (next === null, o
  // comum na prática) devolvia os resultados direto, sem passar por
  // alertaAindaRelevante -- só o caminho de várias páginas filtrava. Mesmo
  // alerta "não relevante" aparecia ou sumia dependendo só de quantas
  // páginas a API devolveu, não da regra de negócio.
  it("aplica alertaAindaRelevante mesmo quando cabe numa única página (next === null)", async () => {
    const relevante = alerta({ id: 1 });
    const naoRelevante = comDocumento(alerta({ id: 2, imediato: true }), { status: "regular" });
    apiGetMock.mockResolvedValueOnce({
      data: { count: 2, next: null, previous: null, results: [relevante, naoRelevante] },
    });

    const resultado = await listarAlertasPendentes();

    expect(resultado.map((a) => a.id)).toEqual([1]);
  });
});

describe("listarProcessosRenovacao", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("completa comprovantes_protocolo com lista vazia quando o backend ainda não manda o campo", async () => {
    // Backend sem a STC-771 (deploy manual em produção): sem o campo, ler
    // `.length` quebraria o detalhe do documento.
    const semCampo = { id: 9, status: "em_andamento" } as unknown as ProcessoRenovacao;
    const comCampo = {
      id: 8,
      status: "concluido",
      comprovantes_protocolo: [{ id: 1 }],
    } as unknown as ProcessoRenovacao;
    apiGetMock.mockResolvedValue({ data: [semCampo, comCampo] });

    const processos = await listarProcessosRenovacao(55);

    expect(processos[0].comprovantes_protocolo).toEqual([]);
    expect(processos[1].comprovantes_protocolo).toEqual([{ id: 1 }]);
  });
});
