import { describe, expect, it } from "vitest";
import {
  atributosDeParametros,
  atributosDoSchema,
  objetosReferenciados,
  tipoLegivel,
} from "./openapiAtributos";
import type { OperacaoDoc } from "./openapi";
import type { OpenApiDocument } from "@/types/openapi";

const DOC: OpenApiDocument = {
  openapi: "3.0.3",
  info: { title: "Atlas", version: "1" },
  paths: {},
  components: {
    schemas: {
      Unidade: {
        type: "object",
        properties: {
          id: { type: "integer" },
          nome: { type: "string" },
          setor: { $ref: "#/components/schemas/Setor" },
        },
      },
      Setor: {
        type: "object",
        properties: { id: { type: "integer" }, nome: { type: "string" } },
      },
      DocumentoUnidadeRead: {
        type: "object",
        properties: {
          id: { type: "integer", readOnly: true },
          status: {
            type: "string",
            enum: ["vencido", "regular"],
            description: "Status atual.",
          },
          validade: { type: "string", format: "date", nullable: true },
          unidade: {
            allOf: [{ $ref: "#/components/schemas/Unidade" }],
            readOnly: true,
          },
          responsaveis: {
            type: "array",
            items: { $ref: "#/components/schemas/Unidade" },
            readOnly: true,
          },
        },
        required: ["id", "unidade"],
      },
    },
  },
};

describe("tipoLegivel", () => {
  it("nomeia um campo com $ref direto pelo nome do schema, sem expandir propriedades", () => {
    expect(
      tipoLegivel(DOC, { allOf: [{ $ref: "#/components/schemas/Unidade" }] }),
    ).toBe("Unidade");
  });

  it("lista de $ref vira 'lista de <Nome>'", () => {
    expect(
      tipoLegivel(DOC, {
        type: "array",
        items: { $ref: "#/components/schemas/Unidade" },
      }),
    ).toBe("lista de Unidade");
  });

  it("primitivo com format aparece entre parênteses", () => {
    expect(tipoLegivel(DOC, { type: "string", format: "date" })).toBe(
      "string (date)",
    );
  });

  it("enum vira só 'enum' (os valores ficam em valoresEnum, não no tipo)", () => {
    expect(tipoLegivel(DOC, { type: "string", enum: ["a", "b"] })).toBe("enum");
  });

  it("oneOf sem type/enum/$ref no nível de fora usa a 1ª alternativa (ex. Usuario.foto_url)", () => {
    expect(
      tipoLegivel(DOC, {
        oneOf: [{ type: "string", format: "uri" }, { type: "string" }],
      }),
    ).toBe("string (uri)");
  });
});

describe("atributosDoSchema", () => {
  const atributos = atributosDoSchema(DOC, {
    $ref: "#/components/schemas/DocumentoUnidadeRead",
  });

  it("uma linha por propriedade do objeto raiz, sem entrar nas propriedades do schema aninhado (unidade)", () => {
    expect(atributos.map((a) => a.nome)).toEqual([
      "id",
      "status",
      "validade",
      "unidade",
      "responsaveis",
    ]);
    const unidade = atributos.find((a) => a.nome === "unidade")!;
    expect(unidade.tipo).toBe("Unidade");
  });

  it("obrigatorio reflete o required do schema raiz", () => {
    expect(atributos.find((a) => a.nome === "id")!.obrigatorio).toBe(true);
    expect(atributos.find((a) => a.nome === "status")!.obrigatorio).toBe(false);
  });

  it("somenteLeitura e nullable batem com o schema", () => {
    expect(atributos.find((a) => a.nome === "id")!.somenteLeitura).toBe(true);
    expect(atributos.find((a) => a.nome === "validade")!.nullable).toBe(true);
  });

  it("valoresEnum populado quando o campo tem enum", () => {
    expect(atributos.find((a) => a.nome === "status")!.valoresEnum).toEqual([
      "vencido",
      "regular",
    ]);
  });

  it("lista vazia quando o schema não resolve pra um objeto com properties", () => {
    expect(atributosDoSchema(DOC, { type: "string" })).toEqual([]);
  });

  it("refNome populado só quando o campo referencia um objeto de verdade (não enum)", () => {
    expect(atributos.find((a) => a.nome === "unidade")!.refNome).toBe(
      "Unidade",
    );
    expect(atributos.find((a) => a.nome === "responsaveis")!.refNome).toBe(
      "Unidade",
    );
    expect(atributos.find((a) => a.nome === "status")!.refNome).toBeNull();
    expect(atributos.find((a) => a.nome === "id")!.refNome).toBeNull();
  });
});

describe("atributosDeParametros", () => {
  it("mapeia OpenApiParameter pra AtributoLinha, sem 'somente leitura'", () => {
    const atributos = atributosDeParametros(DOC, [
      {
        name: "status",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["a"] },
      },
    ]);
    expect(atributos).toEqual([
      {
        nome: "status",
        tipo: "enum",
        obrigatorio: false,
        somenteLeitura: false,
        nullable: false,
        refNome: null,
        descricao: "",
        valoresEnum: ["a"],
      },
    ]);
  });

  it("undefined vira lista vazia", () => {
    expect(atributosDeParametros(DOC, undefined)).toEqual([]);
  });
});

describe("objetosReferenciados", () => {
  it("coleta objetos referenciados no request e na resposta, sem duplicar", () => {
    const operacoes: OperacaoDoc[] = [
      {
        id: "op1",
        metodo: "get",
        path: "/x/",
        tag: "X",
        recurso: "x",
        operation: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DocumentoUnidadeRead" },
                },
              },
            },
          },
        },
      },
      {
        id: "op2",
        metodo: "post",
        path: "/x/",
        tag: "X",
        recurso: "x",
        operation: {
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Unidade" },
              },
            },
          },
          responses: {},
        },
      },
    ];
    // "Setor" também entra (transitivo, via Unidade.setor) -- Unidade em
    // si é deduplicado entre op1 (indireto, dentro de DocumentoUnidadeRead)
    // e op2 (direto, o próprio corpo do request).
    expect(objetosReferenciados(DOC, operacoes)).toEqual(["Setor", "Unidade"]);
  });

  it("inclui objeto referenciado só indiretamente, dentro de outro já alcançado (transitivo)", () => {
    // Achado no review: a operação referencia DocumentoUnidadeRead
    // diretamente (nível 1), que por sua vez tem unidade: Unidade (também
    // nível 1, campo do schema direto) -- Unidade.setor: Setor é nível 2
    // (só alcançável entrando nos campos de Unidade, não da operação em
    // si). Sem recursão, "Setor" nunca entraria na lista, mas
    // ObjetoReferencia roda atributosDoSchema de novo sobre Unidade (pra
    // montar a seção dela) e geraria um link pra #objeto-Setor mesmo
    // assim -- apontando pra uma seção nunca renderizada.
    const operacoes: OperacaoDoc[] = [
      {
        id: "op1",
        metodo: "get",
        path: "/x/",
        tag: "X",
        recurso: "x",
        operation: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DocumentoUnidadeRead" },
                },
              },
            },
          },
        },
      },
    ];
    expect(objetosReferenciados(DOC, operacoes)).toEqual(["Setor", "Unidade"]);
  });

  it("lista vazia quando nenhuma operação referencia objeto nenhum", () => {
    const operacoes: OperacaoDoc[] = [
      {
        id: "op1",
        metodo: "get",
        path: "/x/",
        tag: "X",
        recurso: "x",
        operation: { responses: {} },
      },
    ];
    expect(objetosReferenciados(DOC, operacoes)).toEqual([]);
  });
});
