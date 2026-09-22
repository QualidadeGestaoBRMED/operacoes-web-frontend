import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcularGradeMapa,
  calcularResumoMapa,
  celulaDaGrade,
} from "./legalizacaoMapa";
import type { DocumentoUnidade } from "@/types/legalizacao";
import type { Unidade } from "@/types";

function unidade(id: number, nome: string): Unidade {
  return { id, nome, codigo: nome.toLowerCase(), cidade: nome, ativa: true, rede: "padrao" };
}

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
    unidade: unidade(1, "Niterói"),
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

const NITEROI = unidade(1, "Niterói");
const VITORIA = unidade(2, "Vitória");

describe("calcularGradeMapa / celulaDaGrade", () => {
  it("marca como pendente uma combinação unidade+categoria sem nenhum documento", () => {
    const grade = calcularGradeMapa([], [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "residuos")).toEqual({
      bucket: "pendente",
      contagem: 0,
    });
  });

  it("marca como regular quando o único documento está em dia", () => {
    const docs = [documento({ unidade: NITEROI, status: "regular" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao")).toEqual({
      bucket: "regular",
      contagem: 1,
    });
  });

  it("nao_aplicavel conta como regular", () => {
    const docs = [documento({ unidade: NITEROI, status: "nao_aplicavel" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao").bucket).toBe(
      "regular",
    );
  });

  it("vencido vence sobre qualquer outro status na mesma célula", () => {
    const docs = [
      documento({ id: 1, unidade: NITEROI, status: "vencido" }),
      documento({ id: 2, unidade: NITEROI, status: "em_andamento" }),
      documento({ id: 3, unidade: NITEROI, status: "regular" }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao")).toEqual({
      bucket: "vencido",
      contagem: 1,
    });
  });

  it("protocolado entra no bucket atencao (não tem bucket próprio)", () => {
    const docs = [documento({ unidade: NITEROI, status: "protocolado" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao")).toEqual({
      bucket: "atencao",
      contagem: 1,
    });
  });

  it("documento a vencer (prazo próximo) entra em atencao mesmo sem status protocolado", () => {
    const hoje = new Date("2026-09-03T12:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(hoje);
    const docs = [
      documento({
        unidade: NITEROI,
        status: "em_andamento",
        validade: "2026-09-10",
      }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao").bucket).toBe(
      "atencao",
    );
    vi.useRealTimers();
  });

  it("agrega mais de um documento da mesma categoria na mesma célula", () => {
    const docs = [
      documento({ id: 1, unidade: NITEROI, status: "vencido" }),
      documento({
        id: 2,
        unidade: NITEROI,
        status: "vencido",
        tipo_documento: {
          id: 2,
          codigo: "licenca",
          nome: "Licença Sanitária",
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
      }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao")).toEqual({
      bucket: "vencido",
      contagem: 2,
    });
  });

  it("nao_iniciado tem bucket próprio, não conta como regular", () => {
    const docs = [documento({ unidade: NITEROI, status: "nao_iniciado" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao")).toEqual({
      bucket: "nao_iniciado",
      contagem: 1,
    });
  });

  it("não mistura documentos de unidades diferentes na mesma célula", () => {
    const docs = [
      documento({ id: 1, unidade: NITEROI, status: "vencido" }),
      documento({ id: 2, unidade: VITORIA, status: "regular" }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI, VITORIA]);
    expect(celulaDaGrade(grade, NITEROI.id, "regularizacao").bucket).toBe(
      "vencido",
    );
    expect(celulaDaGrade(grade, VITORIA.id, "regularizacao").bucket).toBe(
      "regular",
    );
  });
});

describe("calcularResumoMapa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("conta documentos vencidos e em quantas unidades distintas eles aparecem", () => {
    const docs = [
      documento({ id: 1, unidade: NITEROI, status: "vencido" }),
      documento({
        id: 2,
        unidade: NITEROI,
        status: "vencido",
        tipo_documento: {
          ...documento().tipo_documento,
          id: 2,
          categoria: "equipamentos",
        },
      }),
      documento({ id: 3, unidade: VITORIA, status: "vencido" }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI, VITORIA]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.vencidos).toEqual({ documentos: 3, unidades: 2 });
  });

  it("sem pendência conta unidades onde toda célula é regular ou pendente", () => {
    const docs = [documento({ unidade: NITEROI, status: "regular" })];
    // Vitória não tem documento nenhum -- todas as células dela são
    // "pendente", o que também conta como "sem pendência" (decisão de
    // produto: pendente não implica que a unidade precisa daquele
    // documento).
    const grade = calcularGradeMapa(docs, [NITEROI, VITORIA]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.semPendencia).toEqual({ unidades: 2, total: 2 });
  });

  it("unidade com pelo menos um vencido não conta como sem pendência", () => {
    const docs = [documento({ unidade: NITEROI, status: "vencido" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.semPendencia).toEqual({ unidades: 0, total: 1 });
  });

  it("unidade com célula em encerramento não conta como sem pendência", () => {
    const docs = [
      documento({ unidade: NITEROI, status: "unidade_encerramento" }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.semPendencia).toEqual({ unidades: 0, total: 1 });
  });

  it("documento em_andamento com prazo próximo conta só em aVencer, não também em emAndamento", () => {
    const docs = [
      documento({
        unidade: NITEROI,
        status: "em_andamento",
        validade: "2026-09-10",
      }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.aVencer).toEqual({ documentos: 1, unidades: 1 });
    expect(resumo.emAndamento).toEqual({ documentos: 0, unidades: 0 });
  });

  it("documento vencido com validade ainda dentro do prazo conta só em vencidos, não também em aVencer", () => {
    const docs = [
      documento({
        unidade: NITEROI,
        status: "vencido",
        validade: "2026-09-10",
      }),
    ];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.vencidos).toEqual({ documentos: 1, unidades: 1 });
    expect(resumo.aVencer).toEqual({ documentos: 0, unidades: 0 });
  });

  it("unidade com todos os documentos nao_iniciado não conta como sem pendência", () => {
    const docs = [documento({ unidade: NITEROI, status: "nao_iniciado" })];
    const grade = calcularGradeMapa(docs, [NITEROI]);
    const resumo = calcularResumoMapa(docs, grade);
    expect(resumo.semPendencia).toEqual({ unidades: 0, total: 1 });
  });
});
