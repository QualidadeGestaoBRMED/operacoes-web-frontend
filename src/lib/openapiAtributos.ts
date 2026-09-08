import {
  corpoDaOperacao,
  nomeDoRef,
  resolverSchema,
  respostaDeSucesso,
} from "./openapi";
import type { OperacaoDoc } from "./openapi";
import type {
  OpenApiDocument,
  OpenApiParameter,
  OpenApiSchema,
} from "@/types/openapi";

// Âncora da seção "Objetos" pra um schema -- id compartilhado entre quem
// LINKA (TabelaAtributos) e quem RENDERIZA a seção (ObjetoReferencia), pra
// não divergir o formato num lugar só.
export function idObjeto(nome: string): string {
  return `objeto-${nome}`;
}

// Rótulo de tipo legível pra tabela de atributos -- não expande o objeto
// referenciado numa árvore (decisão da issue, "sem árvore de schema
// aninhada"): só nomeia o schema, quem quiser o detalhe abre a seção dele
// na navegação lateral.
export function tipoLegivel(
  doc: OpenApiDocument,
  schema: OpenApiSchema,
): string {
  const ref = nomeDoRef(schema);
  if (ref) return schema.type === "array" ? `lista de ${ref}` : ref;

  if (schema.type === "array" && schema.items) {
    const refItem = nomeDoRef(schema.items);
    if (refItem) return `lista de ${refItem}`;
    return `lista de ${tipoLegivel(doc, schema.items)}`;
  }

  if (schema.enum) return "enum";

  // oneOf sem type no nível de fora -- achado real no schema: campo tipo
  // "URL ou string vazia" (ex. Usuario.foto_url) vem como
  // oneOf: [{type:string,format:uri}, {type:string,maxLength:0}], sem
  // $ref/enum/type próprio. Sem isso, caía no fallback "any" -- usa a 1ª
  // alternativa do oneOf, que já cobre o caso real observado.
  if (schema.oneOf?.[0]) return tipoLegivel(doc, schema.oneOf[0]);

  const formato = schema.format ? ` (${schema.format})` : "";
  return `${schema.type ?? "any"}${formato}`;
}

// Nome do ref só quando resolve pra um objeto de verdade (tem
// `properties`) -- um enum também tem $ref próprio (ex.
// StatusDocumentoUnidadeEnum), mas esse não ganha seção própria de objeto,
// já mostra os valores inline em valoresEnum.
function refNomeSeObjeto(
  doc: OpenApiDocument,
  schema: OpenApiSchema,
): string | null {
  const ref =
    nomeDoRef(schema) ??
    (schema.type === "array" ? nomeDoRef(schema.items) : null);
  if (!ref) return null;
  return resolverSchema(doc, { $ref: `#/components/schemas/${ref}` })
    ?.properties
    ? ref
    : null;
}

export interface AtributoLinha {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  somenteLeitura: boolean;
  nullable: boolean;
  descricao: string;
  valoresEnum: string[] | null;
  // Nome do objeto referenciado, só quando `tipo` aponta pra um objeto de
  // verdade -- usado pra virar link clicável até a seção "Objetos" (não
  // um enum, não um primitivo).
  refNome: string | null;
}

// Achata só 1 nível (o objeto raiz do request/response) -- campo aninhado
// vira uma linha só com o tipo nomeado (tipoLegivel), não expande as
// propriedades de dentro dele na mesma tabela.
export function atributosDoSchema(
  doc: OpenApiDocument,
  schemaOuRef: OpenApiSchema | undefined,
): AtributoLinha[] {
  const schema = resolverSchema(doc, schemaOuRef);
  if (!schema?.properties) return [];

  const obrigatorios = new Set(schema.required ?? []);

  return Object.entries(schema.properties).map(([nome, propriedade]) => ({
    nome,
    tipo: tipoLegivel(doc, propriedade),
    obrigatorio: obrigatorios.has(nome),
    somenteLeitura: propriedade.readOnly ?? false,
    nullable: propriedade.nullable ?? false,
    descricao: propriedade.description ?? "",
    valoresEnum:
      propriedade.enum ?? resolverSchema(doc, propriedade)?.enum ?? null,
    refNome: refNomeSeObjeto(doc, propriedade),
  }));
}

// Todo objeto (com properties de verdade, não enum) alcançável a partir de
// alguma operação -- direto (campo do corpo/resposta) OU indireto (campo de
// outro objeto já alcançado, transitivo) -- achado no review comparando com
// a Stripe: campos apontavam pra um nome de schema (ex. "unidade: Unidade")
// sem NENHUM lugar na página explicando o que aquele schema tem dentro.
//
// Precisa ser transitivo, não só 1 nível: achado em review posterior --
// ObjetoReferencia.tsx roda atributosDoSchema de novo sobre CADA objeto
// desta lista (pras propriedades do objeto em si), e qualquer campo dessas
// propriedades que referencie OUTRO schema também vira link
// (TabelaAtributos.tsx). Um objeto só alcançável por uma cadeia de 2+ refs
// (nunca o schema direto de nenhuma operação) ficava fora de `objetos`, e
// esse link apontava pra um id inexistente no DOM -- clique sem efeito,
// sem erro visível. Fixpoint (fila `pendentes`) resolve pra qualquer
// profundidade de cadeia, não só a de 2 níveis observada no achado.
export function objetosReferenciados(
  doc: OpenApiDocument,
  operacoes: OperacaoDoc[],
): string[] {
  const nomes = new Set<string>();
  const pendentes: string[] = [];

  function adicionar(refNome: string | null) {
    if (refNome && !nomes.has(refNome)) {
      nomes.add(refNome);
      pendentes.push(refNome);
    }
  }

  for (const { operation } of operacoes) {
    const corpo = corpoDaOperacao(operation);
    if (corpo) {
      for (const atributo of atributosDoSchema(doc, corpo.schema)) {
        adicionar(atributo.refNome);
      }
    }
    const resposta = respostaDeSucesso(operation);
    if (resposta?.response) {
      for (const atributo of atributosDoSchema(doc, resposta.response)) {
        adicionar(atributo.refNome);
      }
    }
  }

  while (pendentes.length > 0) {
    const nome = pendentes.pop()!;
    const atributos = atributosDoSchema(doc, {
      $ref: `#/components/schemas/${nome}`,
    });
    for (const atributo of atributos) {
      adicionar(atributo.refNome);
    }
  }

  return Array.from(nomes).sort((a, b) => a.localeCompare(b));
}

// Mesma forma de linha da tabela de atributos, pra reaproveitar
// TabelaAtributos também nos parâmetros de query/path -- "somente leitura"
// não se aplica a parâmetro, sempre false.
export function atributosDeParametros(
  doc: OpenApiDocument,
  parametros: OpenApiParameter[] | undefined,
): AtributoLinha[] {
  if (!parametros) return [];
  return parametros.map((parametro) => ({
    nome: parametro.name,
    tipo: parametro.schema ? tipoLegivel(doc, parametro.schema) : "string",
    obrigatorio: parametro.required ?? false,
    somenteLeitura: false,
    nullable: false,
    descricao: parametro.description ?? "",
    valoresEnum: parametro.schema?.enum ?? null,
    refNome: null,
  }));
}
