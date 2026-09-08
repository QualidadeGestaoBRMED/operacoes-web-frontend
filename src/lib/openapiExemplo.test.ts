import { describe, expect, it } from "vitest";
import {
  exemploDeRequestBody,
  exemploDeResposta,
  gerarCurl,
  gerarFetch,
  pathComExemplo,
  valorSintetico,
} from "./openapiExemplo";
import type { OpenApiDocument, OpenApiOperation } from "@/types/openapi";

const DOC: OpenApiDocument = {
  openapi: "3.0.3",
  info: { title: "Atlas", version: "1" },
  paths: {},
  components: {
    schemas: {
      Endereco: {
        type: "object",
        properties: { cidade: { type: "string" } },
      },
      DemandaWrite: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          prioridade: { type: "string", enum: ["alta", "baixa"] },
          confidencial: { type: "boolean" },
          unidade: { type: "integer" },
          data_prevista: { type: "string", format: "date" },
          endereco: { $ref: "#/components/schemas/Endereco" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

describe("valorSintetico", () => {
  it("usa schema.example quando presente, ignora o resto", () => {
    expect(valorSintetico(DOC, { type: "string", example: "valor real" })).toBe(
      "valor real",
    );
  });

  it("string sem format vira 'string', com format vira o valor do format", () => {
    expect(valorSintetico(DOC, { type: "string" })).toBe("string");
    expect(valorSintetico(DOC, { type: "string", format: "date" })).toBe(
      "2026-01-01",
    );
  });

  it("enum usa o 1º valor", () => {
    expect(
      valorSintetico(DOC, { type: "string", enum: ["alta", "baixa"] }),
    ).toBe("alta");
  });

  it("integer/number vira 1, boolean vira true", () => {
    expect(valorSintetico(DOC, { type: "integer" })).toBe(1);
    expect(valorSintetico(DOC, { type: "boolean" })).toBe(true);
  });

  it("array constrói 1 item de exemplo dentro", () => {
    expect(
      valorSintetico(DOC, { type: "array", items: { type: "string" } }),
    ).toEqual(["string"]);
  });

  it("objeto aninhado (via $ref) é expandido de verdade (diferente da tabela de atributos, que só nomeia)", () => {
    const valor = valorSintetico(DOC, {
      $ref: "#/components/schemas/DemandaWrite",
    }) as Record<string, unknown>;
    expect(valor.endereco).toEqual({ cidade: "string" });
  });

  it("campo readOnly não entra no exemplo de corpo de escrita (incluirSomenteLeitura: false)", () => {
    const valor = valorSintetico(
      DOC,
      {
        type: "object",
        properties: {
          id: { type: "integer", readOnly: true },
          nome: { type: "string" },
        },
      },
      { incluirSomenteLeitura: false },
    ) as Record<string, unknown>;
    expect(valor).toEqual({ nome: "string" });
  });

  it("campo readOnly entra no exemplo por padrão (resposta/objeto, achado real: serializer de leitura é quase todo readOnly)", () => {
    const valor = valorSintetico(DOC, {
      type: "object",
      properties: {
        id: { type: "integer", readOnly: true },
        nome: { type: "string" },
      },
    }) as Record<string, unknown>;
    expect(valor).toEqual({ id: 1, nome: "string" });
  });

  it("oneOf sem type/enum/$ref no nível de fora usa a 1ª alternativa (ex. Usuario.foto_url)", () => {
    expect(
      valorSintetico(DOC, {
        oneOf: [{ type: "string", format: "uri" }, { type: "string" }],
      }),
    ).toBe("https://exemplo.com");
  });
});

describe("exemploDeRequestBody / exemploDeResposta", () => {
  const operationComBody: OpenApiOperation = {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/DemandaWrite" },
        },
      },
    },
    responses: {
      "201": {
        content: {
          "application/json": {
            example: { id: 1, titulo: "Exemplo real anotado no backend" },
          },
        },
      },
    },
  };

  it("null quando a operação não tem requestBody", () => {
    expect(exemploDeRequestBody(DOC, {})).toBeNull();
  });

  it("gera valor sintético a partir do schema quando não há example/examples explícito", () => {
    const corpo = exemploDeRequestBody(DOC, operationComBody) as Record<
      string,
      unknown
    >;
    expect(corpo.titulo).toBe("string");
    expect(corpo.confidencial).toBe(true);
  });

  it("resposta prefere o example explícito do media type sobre gerar sintético", () => {
    const resposta = exemploDeResposta(DOC, operationComBody);
    expect(resposta).toEqual({
      status: "201",
      corpo: { id: 1, titulo: "Exemplo real anotado no backend" },
    });
  });

  it("null quando não há resposta 2xx", () => {
    expect(exemploDeResposta(DOC, { responses: { "404": {} } })).toBeNull();
  });
});

describe("pathComExemplo", () => {
  it("substitui {param} pelo example do parâmetro de path quando existe", () => {
    expect(
      pathComExemplo("/documentos/{id}/", [
        { name: "id", in: "path", schema: { type: "integer", example: 42 } },
      ]),
    ).toBe("/documentos/42/");
  });

  it("cai pra '1' quando não há example no parâmetro de path", () => {
    expect(
      pathComExemplo("/documentos/{id}/", [{ name: "id", in: "path" }]),
    ).toBe("/documentos/1/");
  });
});

describe("gerarCurl / gerarFetch", () => {
  it("curl sem corpo não inclui -d nem Content-Type", () => {
    const curl = gerarCurl({ metodo: "get", path: "/x/", corpo: null });
    expect(curl).not.toContain("-d");
    expect(curl).not.toContain("Content-Type");
    expect(curl).toContain("GET");
  });

  it("curl com corpo inclui Content-Type e o JSON do corpo", () => {
    const curl = gerarCurl({
      metodo: "post",
      path: "/x/",
      corpo: { titulo: "a" },
    });
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).toContain('"titulo": "a"');
  });

  it("fetch sem corpo não inclui body nem Content-Type", () => {
    const codigo = gerarFetch({ metodo: "get", path: "/x/", corpo: null });
    expect(codigo).not.toContain("body:");
    expect(codigo).not.toContain("Content-Type");
  });

  it("fetch com corpo inclui JSON.stringify do corpo", () => {
    const codigo = gerarFetch({
      metodo: "post",
      path: "/x/",
      corpo: { titulo: "a" },
    });
    expect(codigo).toContain("body: JSON.stringify(");
    expect(codigo).toContain('"titulo": "a"');
  });
});
