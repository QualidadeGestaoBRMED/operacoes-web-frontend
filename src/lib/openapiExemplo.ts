import { corpoDaOperacao, resolverSchema, respostaDeSucesso } from "./openapi";
import type {
  OpenApiDocument,
  OpenApiMediaType,
  OpenApiOperation,
  OpenApiSchema,
} from "@/types/openapi";

const PROFUNDIDADE_MAXIMA = 4;

// Valor plausível a partir só do TIPO do campo -- não é dado real (o schema
// real quase não tem `example` preenchido, ver STC-397). Prioriza
// schema.example quando existe (cobre os poucos endpoints anotados à mão
// no backend); o resto é sintético.
function valorPorFormato(schema: OpenApiSchema): unknown {
  if (schema.enum) return schema.enum[0];
  // oneOf sem type/enum/$ref no nível de fora -- achado real no schema:
  // campo opcional tipo URL (ex. Usuario.foto_url) vem como
  // oneOf: [{type:string,format:uri}, {type:string,maxLength:0}] (padrão
  // do drf-spectacular pra "URLField em branco permitido"). Sem checar
  // oneOf aqui, caía no "string" genérico -- perde o format (uri) da 1ª
  // alternativa, mas pelo menos não vira "any"/null como tipoLegivel()
  // fazia antes da mesma correção.
  if (schema.oneOf?.[0]) return valorPorFormato(schema.oneOf[0]);
  switch (schema.format) {
    case "date":
      return "2026-01-01";
    case "date-time":
      return "2026-01-01T12:00:00Z";
    case "email":
      return "usuario@grupobrmed.com.br";
    case "uri":
    case "url":
      return "https://exemplo.com";
    default:
      return "string";
  }
}

interface OpcoesValorSintetico {
  profundidade?: number;
  // false só pra corpo de REQUEST (exemploDeRequestBody abaixo) -- campo
  // readOnly não pode ser enviado pelo cliente, então não faz sentido
  // aparecer no exemplo de request. Resposta e "Objeto" de referência são
  // o INVERSO: readOnly é exatamente o que a API devolve de verdade (a
  // maioria dos campos de um serializer de leitura é readOnly, por
  // convenção do drf-spectacular) -- achado no review comparando com o
  // schema real: excluir readOnly também da resposta apagava a maioria
  // dos campos do exemplo gerado (até o próprio `id`), tornando o "gerado
  // a partir do schema real" enganoso. Default true (inclui) porque
  // resposta/objeto são o caso mais comum na página (ela é só-leitura).
  incluirSomenteLeitura?: boolean;
}

export function valorSintetico(
  doc: OpenApiDocument,
  schemaOuRef: OpenApiSchema | undefined,
  opcoes: OpcoesValorSintetico = {},
): unknown {
  const { profundidade = 0, incluirSomenteLeitura = true } = opcoes;
  const schema = resolverSchema(doc, schemaOuRef);
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (profundidade >= PROFUNDIDADE_MAXIMA) return null;

  if (schema.type === "array") {
    const item = schema.items
      ? valorSintetico(doc, schema.items, {
          profundidade: profundidade + 1,
          incluirSomenteLeitura,
        })
      : null;
    return item === null ? [] : [item];
  }

  if (schema.type === "object" || schema.properties) {
    const objeto: Record<string, unknown> = {};
    for (const [nome, propriedade] of Object.entries(schema.properties ?? {})) {
      if (propriedade.readOnly && !incluirSomenteLeitura) continue;
      objeto[nome] = valorSintetico(doc, propriedade, {
        profundidade: profundidade + 1,
        incluirSomenteLeitura,
      });
    }
    return objeto;
  }

  switch (schema.type) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "string":
      return valorPorFormato(schema);
    default:
      return schema.oneOf?.[0]
        ? valorSintetico(doc, schema.oneOf[0], opcoes)
        : null;
  }
}

function valorDeMediaType(
  doc: OpenApiDocument,
  media: OpenApiMediaType | undefined,
  opcoes?: OpcoesValorSintetico,
): unknown {
  if (!media) return null;
  if (media.example !== undefined) return media.example;
  const primeiroExemplo = media.examples
    ? Object.values(media.examples)[0]
    : undefined;
  if (primeiroExemplo?.value !== undefined) return primeiroExemplo.value;
  return valorSintetico(doc, media.schema, opcoes);
}

export function exemploDeRequestBody(
  doc: OpenApiDocument,
  operation: OpenApiOperation,
): unknown {
  const corpo = corpoDaOperacao(operation);
  if (!corpo) return null;
  const media = operation.requestBody?.content?.["application/json"];
  const opcoes = { incluirSomenteLeitura: false };
  return (
    valorDeMediaType(doc, media, opcoes) ??
    valorSintetico(doc, corpo.schema, opcoes)
  );
}

export interface ExemploResposta {
  status: string;
  corpo: unknown;
}

export function exemploDeResposta(
  doc: OpenApiDocument,
  operation: OpenApiOperation,
): ExemploResposta | null {
  const info = respostaDeSucesso(operation);
  if (!info) return null;
  const media =
    operation.responses?.[info.status]?.content?.["application/json"];
  return { status: info.status, corpo: valorDeMediaType(doc, media) };
}

// Substitui {param} do path por um valor plausível -- parâmetros de path
// são sempre id numérico neste schema (achado real, nenhuma rota usa slug).
export function pathComExemplo(
  path: string,
  parametros: OpenApiOperation["parameters"],
): string {
  return path.replace(/\{(\w+)\}/g, (match, nome: string) => {
    const parametro = parametros?.find(
      (p) => p.name === nome && p.in === "path",
    );
    const exemplo = parametro?.schema?.example;
    if (typeof exemplo === "string" || typeof exemplo === "number")
      return String(exemplo);
    return "1";
  });
}

interface CodigoExemploOpcoes {
  metodo: string;
  path: string;
  corpo: unknown;
}

// Placeholder de propósito, não uma URL real -- não há um domínio de API
// confirmável a partir deste repositório (o frontend chama seu proxy
// same-origin, `/api/backend`; o domínio real do backend Django varia por
// ambiente, ver NEXT_PUBLIC_API_URL).
const BASE_URL_EXEMPLO = "{API_BASE_URL}";

export function gerarCurl({
  metodo,
  path,
  corpo,
}: CodigoExemploOpcoes): string {
  const linhas = [
    `curl -X ${metodo.toUpperCase()} "${BASE_URL_EXEMPLO}${path}" \\`,
    `  -H "Authorization: Bearer <access_token>"`,
  ];
  if (corpo !== null && corpo !== undefined) {
    linhas[linhas.length - 1] += " \\";
    linhas.push(`  -H "Content-Type: application/json" \\`);
    linhas.push(`  -d '${JSON.stringify(corpo, null, 2)}'`);
  }
  return linhas.join("\n");
}

export function gerarFetch({
  metodo,
  path,
  corpo,
}: CodigoExemploOpcoes): string {
  const opcoes = [
    `method: "${metodo.toUpperCase()}"`,
    `headers: {`,
    `  Authorization: "Bearer <access_token>",`,
  ];
  if (corpo !== null && corpo !== undefined) {
    opcoes.push(`  "Content-Type": "application/json",`);
  }
  opcoes.push(`},`);
  if (corpo !== null && corpo !== undefined) {
    opcoes.push(
      `body: JSON.stringify(${JSON.stringify(corpo, null, 2).replace(/\n/g, "\n  ")}),`,
    );
  }

  return [
    `const resposta = await fetch("${BASE_URL_EXEMPLO}${path}", {`,
    ...opcoes.map((linha) => `  ${linha}`),
    `});`,
    `const dados = await resposta.json();`,
  ].join("\n");
}
