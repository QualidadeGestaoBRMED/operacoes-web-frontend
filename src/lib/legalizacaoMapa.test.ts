import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcularGradeMapa,
  calcularResumoMapa,
  celulaDaGrade,
  checklistDaCelula,
  estaEmAtencao,
  indiceDoChecklist,
  filtroDaSituacao,
  situacaoNaUrl,
  textoDeCadastrados,
  type BucketCelula,
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


describe("situação da célula na Lista (STC-714)", () => {
  function emDias(dias: number): string {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data.toISOString().slice(0, 10);
  }

  it("só os buckets que filtram vão para a URL", () => {
    expect(situacaoNaUrl("vencido")).toBe("vencido");
    expect(situacaoNaUrl("atencao")).toBe("atencao");
    expect(situacaoNaUrl("andamento")).toBe("andamento");
    expect(situacaoNaUrl("nao_iniciado")).toBe("nao_iniciado");
    expect(situacaoNaUrl("encerramento")).toBe("encerramento");
    expect(situacaoNaUrl("regular")).toBeNull();
    expect(situacaoNaUrl("pendente")).toBeNull();
  });

  it("situação vira filtro de Status ou de Atenção; valor desconhecido não filtra", () => {
    expect(filtroDaSituacao("vencido")).toEqual({ status: "vencido", emAtencao: false });
    expect(filtroDaSituacao("andamento")).toEqual({ status: "em_andamento", emAtencao: false });
    expect(filtroDaSituacao("encerramento")).toEqual({
      status: "unidade_encerramento",
      emAtencao: false,
    });
    expect(filtroDaSituacao("atencao")).toEqual({ emAtencao: true });
    for (const invalido of [null, "regular", "pendente", "xyz", "toString"]) {
      expect(filtroDaSituacao(invalido)).toEqual({ emAtencao: false });
    }
  });

  it("a Lista filtrada pela situação mostra a mesma quantidade que a célula conta", () => {
    let id = 0;
    const doc = (overrides: Partial<DocumentoUnidade>) => documento({ id: ++id, ...overrides });
    const casos: Record<string, DocumentoUnidade[]> = {
      vencido: [doc({ status: "vencido", validade: emDias(-3) }), doc({ status: "protocolado" })],
      atencao: [
        doc({ status: "protocolado", validade: emDias(200) }),
        doc({ status: "regular", validade: emDias(5) }),
        doc({ status: "regular", validade: emDias(200) }),
      ],
      andamento: [doc({ status: "em_andamento" }), doc({ status: "nao_iniciado" })],
      nao_iniciado: [doc({ status: "nao_iniciado" }), doc({ status: "regular" })],
      encerramento: [doc({ status: "unidade_encerramento" }), doc({ status: "regular" })],
    };

    for (const [esperado, docs] of Object.entries(casos)) {
      const celula = celulaDaGrade(calcularGradeMapa(docs, [NITEROI]), NITEROI.id, "regularizacao");
      expect(celula.bucket).toBe(esperado as BucketCelula);
      const filtro = filtroDaSituacao(situacaoNaUrl(celula.bucket));
      const naLista = docs.filter(
        (d) => (!filtro.status || d.status === filtro.status) && (!filtro.emAtencao || estaEmAtencao(d)),
      );
      expect(naLista).toHaveLength(celula.contagem);
    }
  });
});

describe("checklistDaCelula (STC-866)", () => {
  const base = documento().tipo_documento;
  const tipo = (id: number, nome: string, extra: Partial<typeof base> = {}) => ({
    ...base,
    id,
    nome,
    codigo: `t${id}`,
    ...extra,
  });
  const TIPOS = [
    tipo(1, "Alvará de Funcionamento"),
    tipo(2, "Licença Ambiental"),
    tipo(3, "Bombeiros"),
    tipo(4, "Habite-se"),
    tipo(5, "Publicidade"),
    tipo(6, "Tipo inativo", { ativo: false }),
    tipo(7, "CNES", { categoria: "registros_tecnicos" }),
  ];
  const doc = (tipoId: number, status: DocumentoUnidade["status"], unidadeId = 1) =>
    documento({
      tipo_documento: TIPOS.find((t) => t.id === tipoId)!,
      unidade: unidade(unidadeId, "X"),
      status,
    });

  it("marca cadastrado, falta e não se aplica, com os que faltam primeiro", () => {
    const indice = indiceDoChecklist([
      doc(1, "regular"),
      doc(3, "vencido"),
      doc(3, "regular"),
      doc(5, "nao_aplicavel"),
      // Outra unidade não conta.
      doc(2, "regular", 2),
    ]);
    const checklist = checklistDaCelula(indice, TIPOS, 1, "regularizacao");

    expect(checklist.itens.map((i) => [i.nome, i.situacao, i.quantidade])).toEqual([
      ["Habite-se", "falta", 0],
      ["Licença Ambiental", "falta", 0],
      ["Alvará de Funcionamento", "cadastrado", 1],
      ["Bombeiros", "cadastrado", 2],
      ["Publicidade", "nao_aplica", 0],
    ]);
    // Tipo inativo e de outra categoria ficam fora; o Não aplicável não conta no total.
    expect([checklist.cadastrados, checklist.aplicaveis]).toEqual([2, 4]);
  });

  it("documento cadastrado vale mais que um Não aplicável do mesmo tipo", () => {
    const indice = indiceDoChecklist([doc(1, "nao_aplicavel"), doc(1, "regular")]);
    const [alvara] = checklistDaCelula(indice, TIPOS, 1, "regularizacao").itens.filter(
      (i) => i.tipoId === 1,
    );
    expect(alvara.situacao).toBe("cadastrado");
  });

  it("concorda o texto com o total: singular só quando é 1", () => {
    expect(textoDeCadastrados({ itens: [], cadastrados: 1, aplicaveis: 1 })).toBe(
      "1 de 1 cadastrado",
    );
    expect(textoDeCadastrados({ itens: [], cadastrados: 0, aplicaveis: 1 })).toBe(
      "0 de 1 cadastrado",
    );
    expect(textoDeCadastrados({ itens: [], cadastrados: 1, aplicaveis: 3 })).toBe(
      "1 de 3 cadastrados",
    );
  });
});
