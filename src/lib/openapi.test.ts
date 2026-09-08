import { describe, expect, it } from "vitest";
import {
  agruparOperacoesPorTag,
  apenasOperacoesDeLeitura,
  corpoDaOperacao,
  labelRecurso,
  nomeDoRef,
  operacoesComCabecalhoDeRecurso,
  recursoDoPath,
  resolverSchema,
  respostaDeSucesso,
} from "./openapi";
import type { OperacaoDoc } from "./openapi";
import type { OpenApiDocument } from "@/types/openapi";

// Fixture reduzida, mas com as mesmas formas reais observadas no schema do
// backend (allOf:[{$ref}] pra campo aninhado readOnly, enum com $ref
// próprio, requestBody/responses em application/json) -- não é o schema
// completo, só o suficiente pra exercitar cada função.
const DOC: OpenApiDocument = {
  openapi: "3.0.3",
  info: { title: "Atlas", version: "1" },
  tags: [
    { name: "Plataforma", description: "..." },
    { name: "Legalização", description: "..." },
  ],
  paths: {
    "/api/plataforma/unidades/": {
      get: {
        operationId: "unidades_list",
        summary: "Listar unidades",
        tags: ["Plataforma"],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Unidade" },
              },
            },
          },
        },
      },
    },
    "/api/modulos/legalizacao/documentos/{id}/": {
      get: {
        operationId: "documentos_retrieve",
        summary: "Detalhar documento",
        tags: ["Legalização"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DocumentoUnidadeRead" },
              },
            },
          },
          "404": { description: "Não encontrado." },
        },
      },
      patch: {
        operationId: "documentos_partial_update",
        summary: "Atualizar documento",
        tags: ["Legalização"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DocumentoUnidadeWrite" },
            },
          },
        },
        responses: { "200": { description: "" } },
      },
    },
  },
  components: {
    schemas: {
      Unidade: {
        type: "object",
        properties: {
          id: { type: "integer", readOnly: true },
          nome: { type: "string" },
        },
        required: ["id", "nome"],
      },
      StatusEnum: {
        type: "string",
        enum: ["vencido", "regular"],
      },
      DocumentoUnidadeRead: {
        type: "object",
        properties: {
          id: { type: "integer", readOnly: true },
          status: { $ref: "#/components/schemas/StatusEnum" },
          unidade: {
            allOf: [{ $ref: "#/components/schemas/Unidade" }],
            readOnly: true,
          },
        },
        required: ["id", "unidade"],
      },
      DocumentoUnidadeWrite: {
        type: "object",
        properties: { status: { $ref: "#/components/schemas/StatusEnum" } },
        required: ["status"],
      },
    },
  },
};

describe("agruparOperacoesPorTag", () => {
  it("agrupa por tag na ordem de doc.tags, não alfabética", () => {
    const grupos = agruparOperacoesPorTag(DOC);
    expect(Array.from(grupos.keys())).toEqual(["Plataforma", "Legalização"]);
  });

  it("cada operação (método+path) vira uma entrada, GET e PATCH do mesmo path separados", () => {
    const grupos = agruparOperacoesPorTag(DOC);
    const legalizacao = grupos.get("Legalização")!;
    expect(legalizacao).toHaveLength(2);
    expect(legalizacao.map((o) => o.metodo)).toEqual(["get", "patch"]);
  });

  it("id vem do operationId", () => {
    const grupos = agruparOperacoesPorTag(DOC);
    expect(grupos.get("Plataforma")![0].id).toBe("unidades_list");
  });
});

describe("apenasOperacoesDeLeitura", () => {
  it("mantém só GET, remove POST/PUT/PATCH/DELETE de cada tag", () => {
    const grupos = agruparOperacoesPorTag(DOC);
    const filtrados = apenasOperacoesDeLeitura(grupos);
    expect(filtrados.get("Legalização")!.map((o) => o.metodo)).toEqual(["get"]);
  });

  it("tag sem nenhum GET vira lista vazia, não some do Map", () => {
    const grupos = new Map([
      [
        "SóEscrita",
        [
          {
            id: "a",
            metodo: "post" as const,
            path: "/x/",
            tag: "SóEscrita",
            recurso: "x",
            operation: {},
          },
        ],
      ],
    ]);
    const filtrados = apenasOperacoesDeLeitura(grupos);
    expect(filtrados.get("SóEscrita")).toEqual([]);
  });
});

describe("resolverSchema / nomeDoRef", () => {
  it("resolve $ref direto", () => {
    const resolvido = resolverSchema(DOC, {
      $ref: "#/components/schemas/Unidade",
    });
    expect(resolvido?.properties?.nome).toBeDefined();
  });

  it("resolve allOf:[{$ref}] (padrão de campo aninhado readOnly) e preserva readOnly de fora", () => {
    const campoUnidade =
      DOC.components!.schemas!.DocumentoUnidadeRead.properties!.unidade;
    const resolvido = resolverSchema(DOC, campoUnidade);
    expect(resolvido?.properties?.nome).toBeDefined();
    expect(resolvido?.readOnly).toBe(true);
  });

  it("nomeDoRef extrai o nome do schema tanto de $ref quanto de allOf", () => {
    expect(nomeDoRef({ $ref: "#/components/schemas/Unidade" })).toBe("Unidade");
    expect(
      nomeDoRef({ allOf: [{ $ref: "#/components/schemas/Unidade" }] }),
    ).toBe("Unidade");
    expect(nomeDoRef({ type: "string" })).toBeNull();
  });
});

describe("corpoDaOperacao", () => {
  it("null quando a operação não tem requestBody (GET)", () => {
    const operacao = DOC.paths["/api/plataforma/unidades/"].get!;
    expect(corpoDaOperacao(operacao)).toBeNull();
  });

  it("retorna o schema e required quando tem requestBody (PATCH)", () => {
    const operacao =
      DOC.paths["/api/modulos/legalizacao/documentos/{id}/"].patch!;
    const corpo = corpoDaOperacao(operacao);
    expect(corpo?.required).toBe(true);
    expect(nomeDoRef(corpo!.schema)).toBe("DocumentoUnidadeWrite");
  });
});

describe("respostaDeSucesso", () => {
  it("pega a 1ª resposta 2xx, não uma 4xx", () => {
    const operacao =
      DOC.paths["/api/modulos/legalizacao/documentos/{id}/"].get!;
    const info = respostaDeSucesso(operacao);
    expect(info?.status).toBe("200");
    expect(nomeDoRef(info!.response!)).toBe("DocumentoUnidadeRead");
  });

  it("null quando não há resposta 2xx nenhuma", () => {
    const operacao = { responses: { "404": { description: "..." } } };
    expect(respostaDeSucesso(operacao)).toBeNull();
  });
});

describe("recursoDoPath", () => {
  it("pula 'modulos/<slug>' e pega o segmento seguinte", () => {
    expect(
      recursoDoPath("/api/modulos/gestao-demandas/tipos-gestao/{id}/"),
    ).toBe("tipos-gestao");
  });

  it("sem 'modulos', pega o 2º segmento (ex. plataforma/<recurso>)", () => {
    expect(recursoDoPath("/api/plataforma/unidades/")).toBe("unidades");
  });
});

describe("labelRecurso", () => {
  it("usa o rótulo com acento/plural certo quando conhecido", () => {
    expect(labelRecurso("tipos-gestao")).toBe("Tipos de gestão");
    expect(labelRecurso("notificacoes")).toBe("Notificações");
  });

  it("humaniza (capitaliza + troca hífen por espaço) quando desconhecido", () => {
    expect(labelRecurso("novo-recurso")).toBe("Novo Recurso");
  });
});

describe("operacoesComCabecalhoDeRecurso", () => {
  function operacao(id: string, recurso: string): OperacaoDoc {
    return { id, metodo: "get", path: "/x/", tag: "X", recurso, operation: {} };
  }

  it("grupo pequeno (<= limiar) não ganha cabeçalho nenhum", () => {
    const grupos = new Map([
      ["Pequeno", [operacao("a", "x"), operacao("b", "y")]],
    ]);
    expect(operacoesComCabecalhoDeRecurso(grupos)).toEqual(new Set());
  });

  it("grupo grande ganha cabeçalho só na 1ª operação de cada recurso novo", () => {
    const operacoes = Array.from({ length: 11 }, (_, i) =>
      operacao(`op${i}`, i < 6 ? "recursoA" : "recursoB"),
    );
    const grupos = new Map([["Grande", operacoes]]);
    expect(operacoesComCabecalhoDeRecurso(grupos)).toEqual(
      new Set(["op0", "op6"]),
    );
  });
});
