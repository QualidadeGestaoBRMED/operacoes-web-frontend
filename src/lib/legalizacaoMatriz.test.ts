import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agruparAlertasPorDocumento,
  documentoBateNaBusca,
  documentoBateNaCategoria,
  ordenarDocumentos,
  prazoDocumento,
} from "./legalizacaoMatriz";
import type {
  AlertaRegulatorio,
  DocumentoUnidade,
  ResponsavelDocumento,
} from "@/types/legalizacao";

function documento(
  overrides: Partial<DocumentoUnidade> = {},
): DocumentoUnidade {
  return {
    id: 1,
    tipo_documento: {
      id: 1,
      codigo: "alvara",
      nome: "Alvará de Funcionamento",
      categoria: "regularizacao",
      area_responsavel: "legalizacao",
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
      codigo: "niteroi",
      cidade: "Niterói",
      ativa: true,
      rede: "padrao",
    },
    status: "regular",
    justificativa_excecao: "",
    validade: null,
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("prazoDocumento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devolve — quando não tem validade", () => {
    expect(prazoDocumento(documento({ validade: null }))).toEqual({
      texto: "—",
      urgencia: "sem-prazo",
    });
  });

  it("devolve — pra status coringa mesmo com validade preenchida", () => {
    expect(
      prazoDocumento(
        documento({ status: "nao_aplicavel", validade: "2026-10-01" }),
      ),
    ).toEqual({ texto: "—", urgencia: "sem-prazo" });
  });

  it("calcula vencido há N dias no passado", () => {
    expect(prazoDocumento(documento({ validade: "2026-08-22" }))).toEqual({
      texto: "vencido há 12 dias",
      urgencia: "vencido",
    });
  });

  it("singular pra 1 dia de atraso", () => {
    expect(prazoDocumento(documento({ validade: "2026-09-02" }))).toEqual({
      texto: "vencido há 1 dia",
      urgencia: "vencido",
    });
  });

  it("vence hoje", () => {
    expect(prazoDocumento(documento({ validade: "2026-09-03" }))).toEqual({
      texto: "vence hoje",
      urgencia: "proximo",
    });
  });

  it("marca como próximo dentro do limiar de 15 dias", () => {
    expect(prazoDocumento(documento({ validade: "2026-09-10" }))).toEqual({
      texto: "em 7 dias",
      urgencia: "proximo",
    });
  });

  it("marca como normal acima do limiar de 15 dias", () => {
    expect(prazoDocumento(documento({ validade: "2026-12-01" }))).toEqual({
      texto: "em 89 dias",
      urgencia: "normal",
    });
  });
});

describe("documentoBateNaBusca", () => {
  it("sempre bate quando a busca está vazia", () => {
    expect(documentoBateNaBusca(documento(), "")).toBe(true);
    expect(documentoBateNaBusca(documento(), "   ")).toBe(true);
  });

  it("bate por nome da unidade, sem diferenciar maiúsculas", () => {
    expect(documentoBateNaBusca(documento(), "NITER")).toBe(true);
  });

  it("bate por nome do tipo de documento", () => {
    expect(documentoBateNaBusca(documento(), "alvará")).toBe(true);
  });

  it("não bate quando não encontra em nenhum dos dois campos", () => {
    expect(documentoBateNaBusca(documento(), "vitória")).toBe(false);
  });
});

describe("documentoBateNaCategoria", () => {
  it("sempre bate quando não há categoria selecionada (undefined)", () => {
    expect(documentoBateNaCategoria(documento(), undefined)).toBe(true);
  });

  it("bate quando a categoria do tipo de documento é igual à selecionada", () => {
    expect(
      documentoBateNaCategoria(
        documento({
          tipo_documento: {
            ...documento().tipo_documento,
            categoria: "regularizacao",
          },
        }),
        "regularizacao",
      ),
    ).toBe(true);
  });

  it("não bate quando a categoria do tipo de documento é diferente da selecionada", () => {
    expect(
      documentoBateNaCategoria(
        documento({
          tipo_documento: {
            ...documento().tipo_documento,
            categoria: "regularizacao",
          },
        }),
        "residuos",
      ),
    ).toBe(false);
  });
});

function responsavelPrincipal(nome: string): ResponsavelDocumento[] {
  const [first_name, ...resto] = nome.split(" ");
  return [
    {
      id: 1,
      principal: true,
      created_at: "2026-01-01T00:00:00Z",
      usuario: {
        id: 1,
        username: nome.toLowerCase(),
        email: `${nome.toLowerCase()}@grupobrmed.com.br`,
        first_name,
        last_name: resto.join(" "),
        perfil: null,
        unidade_id: null,
        setor_id: null,
        ativo: true,
        ultimo_acesso: null,
        foto_url: "",
      },
    },
  ];
}

describe("ordenarDocumentos", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devolve a mesma lista, sem reordenar, quando ordenacao é null", () => {
    const lista = [
      documento({
        id: 1,
        unidade: { id: 1, nome: "Z", codigo: "z", cidade: "Z", ativa: true, rede: "padrao" },
      }),
      documento({
        id: 2,
        unidade: { id: 2, nome: "A", codigo: "a", cidade: "A", ativa: true, rede: "padrao" },
      }),
    ];
    expect(ordenarDocumentos(lista, null)).toEqual(lista);
  });

  it("não muta o array original (imutabilidade)", () => {
    const lista = [
      documento({
        id: 1,
        unidade: { id: 1, nome: "Z", codigo: "z", cidade: "Z", ativa: true, rede: "padrao" },
      }),
      documento({
        id: 2,
        unidade: { id: 2, nome: "A", codigo: "a", cidade: "A", ativa: true, rede: "padrao" },
      }),
    ];
    const original = [...lista];
    ordenarDocumentos(lista, { campo: "unidade", direcao: "asc" });
    expect(lista).toEqual(original);
  });

  it("ordena por unidade, alfabético, asc e desc", () => {
    const lista = [
      documento({
        id: 1,
        unidade: {
          id: 1,
          nome: "Vitória",
          codigo: "v",
          cidade: "V",
          ativa: true,
          rede: "padrao",
        },
      }),
      documento({
        id: 2,
        unidade: {
          id: 2,
          nome: "Niterói",
          codigo: "n",
          cidade: "N",
          ativa: true,
          rede: "padrao",
        },
      }),
    ];
    expect(
      ordenarDocumentos(lista, { campo: "unidade", direcao: "asc" }).map(
        (d) => d.id,
      ),
    ).toEqual([2, 1]);
    expect(
      ordenarDocumentos(lista, { campo: "unidade", direcao: "desc" }).map(
        (d) => d.id,
      ),
    ).toEqual([1, 2]);
  });

  it("ordena por status seguindo a ordem de fluxo, não alfabética", () => {
    const lista = [
      documento({ id: 1, status: "vencido" }),
      documento({ id: 2, status: "nao_iniciado" }),
      documento({ id: 3, status: "em_andamento" }),
    ];
    // Ordem de fluxo: nao_iniciado < em_andamento < ... < vencido.
    expect(
      ordenarDocumentos(lista, { campo: "status", direcao: "asc" }).map(
        (d) => d.id,
      ),
    ).toEqual([2, 3, 1]);
  });

  it("joga um status fora de ORDEM_STATUS pro final, não pro início", () => {
    // Achado no code review: ORDEM_STATUS.indexOf() devolve -1 (não
    // undefined/null) quando não acha -- sem o fallback pra null no
    // extrator, esse documento ordenaria ANTES de "nao_iniciado" (-1 < 0)
    // em vez de ir pro final, como todo campo sem valor faz aqui. Simula
    // um status novo que o backend já tenha, mas o frontend ainda não
    // mapeou em ORDEM_STATUS.
    const lista = [
      documento({ id: 1, status: "nao_iniciado" }),
      documento({
        id: 2,
        status: "status_desconhecido" as DocumentoUnidade["status"],
      }),
    ];
    expect(
      ordenarDocumentos(lista, { campo: "status", direcao: "asc" }).map(
        (d) => d.id,
      ),
    ).toEqual([1, 2]);
    expect(
      ordenarDocumentos(lista, { campo: "status", direcao: "desc" }).map(
        (d) => d.id,
      ),
    ).toEqual([1, 2]);
  });

  it("ordena por responsável pelo nome, e joga sem responsável pro final", () => {
    const lista = [
      documento({ id: 1, responsaveis: responsavelPrincipal("Zeca") }),
      documento({ id: 2, responsaveis: [] }),
      documento({ id: 3, responsaveis: responsavelPrincipal("Ana") }),
    ];
    expect(
      ordenarDocumentos(lista, { campo: "responsavel", direcao: "asc" }).map(
        (d) => d.id,
      ),
    ).toEqual([3, 1, 2]);
  });

  it("ordena por prazo pelo número real de dias, não pelo texto formatado", () => {
    const lista = [
      documento({ id: 1, validade: "2026-09-20" }), // em 17 dias
      documento({ id: 2, validade: "2026-08-22" }), // vencido há 12 dias
      documento({ id: 3, validade: null }), // sem prazo -- deve ir pro final
      documento({ id: 4, validade: "2026-09-05" }), // em 2 dias
    ];
    expect(
      ordenarDocumentos(lista, { campo: "prazo", direcao: "asc" }).map(
        (d) => d.id,
      ),
    ).toEqual([2, 4, 1, 3]);
  });
});

function alerta(overrides: Partial<AlertaRegulatorio> = {}): AlertaRegulatorio {
  return {
    id: 1,
    documento_unidade: documento(),
    ciclo_referencia: "2026-12-01",
    antecedencia_usada_dias: 60,
    criticidade: "alta",
    imediato: false,
    status_tratamento: "pendente",
    data_geracao: "2026-09-15T12:00:00Z",
    ...overrides,
  };
}

describe("agruparAlertasPorDocumento (STC-443)", () => {
  it("documentos diferentes viram grupos diferentes, um por documento", () => {
    const grupos = agruparAlertasPorDocumento([
      alerta({ id: 1, documento_unidade: documento({ id: 10 }) }),
      alerta({ id: 2, documento_unidade: documento({ id: 11 }) }),
    ]);

    expect(grupos.map((g) => g.documentoId)).toEqual([10, 11]);
    expect(grupos.every((g) => g.totalAlertas === 1)).toBe(true);
  });

  it("vários alertas do MESMO documento viram um grupo só, com a contagem certa", () => {
    const grupos = agruparAlertasPorDocumento([
      alerta({ id: 1, documento_unidade: documento({ id: 10 }) }),
      alerta({ id: 2, documento_unidade: documento({ id: 10 }) }),
      alerta({ id: 3, documento_unidade: documento({ id: 10 }) }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].totalAlertas).toBe(3);
  });

  it("data do grupo é a mais ANTIGA entre os alertas (há quanto tempo isso está pendente)", () => {
    const grupos = agruparAlertasPorDocumento([
      alerta({
        id: 1,
        documento_unidade: documento({ id: 10 }),
        data_geracao: "2026-09-15T12:00:00Z",
      }),
      alerta({
        id: 2,
        documento_unidade: documento({ id: 10 }),
        data_geracao: "2026-09-10T08:00:00Z",
      }),
    ]);

    expect(grupos[0].dataMaisAntiga).toBe("2026-09-10T08:00:00Z");
  });
});
