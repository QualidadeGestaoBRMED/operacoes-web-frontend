import api from "./api";
import type {
  OpenApiDocument,
  OpenApiMetodo,
  OpenApiOperation,
  OpenApiSchema,
} from "@/types/openapi";

const METODOS: OpenApiMetodo[] = ["get", "post", "put", "patch", "delete"];

// ?format=json obrigatório -- achado real testando a tela: o proxy genérico
// (api/backend/[...path]/route.ts) não repassa o header Accept da
// requisição original pro backend, e SpectacularAPIView sem Accept
// explícito devolve YAML por padrão (achado confirmado direto no Django:
// GET /api/schema/ sem Accept → `openapi: 3.0.3\n...`, texto puro, não
// JSON). ?format=json é o jeito padrão do DRF de forçar o formato
// independente de header, funciona através do proxy sem precisar mexer
// nele (é só querystring, já repassada).
export async function buscarSchemaOpenAPI(): Promise<OpenApiDocument> {
  const { data } = await api.get<OpenApiDocument>("/schema", {
    params: { format: "json" },
  });
  return data;
}

export interface OperacaoDoc {
  id: string;
  metodo: OpenApiMetodo;
  path: string;
  operation: OpenApiOperation;
  tag: string;
  // Slug cru do recurso (ex. "tipos-gestao"), derivado do path -- ver
  // recursoDoPath(). Usado só pra AGRUPAR (nav + conteúdo); o texto exibido
  // vem de labelRecurso().
  recurso: string;
}

// Nomes conhecidos com acento/plural corretos -- achado real olhando os 54
// paths do schema: o slug cru (sem acento, com hífen) fica ruim como
// título de seção ("tipos-gestao" em vez de "Tipos de gestão"). Cai pro
// humanizado (capitaliza + troca hífen por espaço) se algum recurso novo
// aparecer sem entrada aqui.
const LABEL_RECURSO: Record<string, string> = {
  categorias: "Categorias",
  demandas: "Demandas",
  etiquetas: "Etiquetas",
  resumo: "Resumo",
  "tipos-gestao": "Tipos de gestão",
  alertas: "Alertas",
  dashboard: "Dashboard",
  documentos: "Documentos",
  "processos-renovacao": "Processos de renovação",
  regras: "Regras",
  "tipos-documento": "Tipos de documento",
  modulos: "Módulos",
  notificacoes: "Notificações",
  perfis: "Perfis",
  "permissoes-usuario": "Permissões de usuário",
  setores: "Setores",
  unidades: "Unidades",
  usuarios: "Usuários",
};

// 1º segmento literal depois do prefixo de módulo -- "/api/modulos/<slug>/
// <recurso>/..." ou "/api/<slug>/<recurso>/...". Não tenta ser genérico
// pra qualquer padrão de URL REST, só pro que o Atlas usa de verdade (2
// formas, vistas nos 54 paths reais do schema).
export function recursoDoPath(path: string): string {
  const segmentos = path.split("/").filter(Boolean);
  const indice = segmentos[1] === "modulos" ? 3 : 2;
  return segmentos[indice] ?? path;
}

export function labelRecurso(recurso: string): string {
  return (
    LABEL_RECURSO[recurso] ??
    recurso
      .split("-")
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(" ")
  );
}

// Ordem = ordem de doc.tags (curada em backend/core/settings/base.py, não
// alfabética) -- dentro de cada tag, ordem natural de doc.paths (a ordem
// que o drf-spectacular já gera, agrupada por ViewSet).
export function agruparOperacoesPorTag(
  doc: OpenApiDocument,
): Map<string, OperacaoDoc[]> {
  const grupos = new Map<string, OperacaoDoc[]>();
  for (const tag of doc.tags ?? []) grupos.set(tag.name, []);

  for (const [path, item] of Object.entries(doc.paths)) {
    for (const metodo of METODOS) {
      const operation = item[metodo];
      if (!operation) continue;
      const tag = operation.tags?.[0] ?? "Outros";
      const lista = grupos.get(tag) ?? [];
      lista.push({
        id: operation.operationId ?? `${metodo}-${path}`,
        metodo,
        path,
        operation,
        tag,
        recurso: recursoDoPath(path),
      });
      grupos.set(tag, lista);
    }
  }
  return grupos;
}

// Só GET -- decisão de produto (não é limitação técnica): a página de docs
// do frontend fica restrita a consulta, sem mostrar o comando pronto de
// criar/editar/excluir. Diferente do Swagger (/api/docs/), que continua
// documentando o CRUD completo -- essa página aqui gera um curl PRONTO PRA
// COLAR no terminal (sem botão de "Try it" como o Swagger), então um POST/
// DELETE aqui é só copiar e rodar com um token real, sem nem passar pelo
// Swagger. Reduz a conveniência do caminho mais arriscado na ferramenta
// mais fácil de navegar, mesmo os dois já estando atrás do mesmo
// IsAdminOperacoes (STC-397) -- não é controle de acesso, é fricção
// deliberada.
export function apenasOperacoesDeLeitura(
  grupos: Map<string, OperacaoDoc[]>,
): Map<string, OperacaoDoc[]> {
  const filtrados = new Map<string, OperacaoDoc[]>();
  for (const [tag, operacoes] of grupos) {
    filtrados.set(
      tag,
      operacoes.filter((operacao) => operacao.metodo === "get"),
    );
  }
  return filtrados;
}

// Grupos com mais operações que isso ganham subtítulo de recurso na
// navegação e no conteúdo -- achado no review de UX: "Plataforma" (31
// operações) e "Gestão de Demandas" (39) numa lista só, sem nenhuma
// subdivisão, viravam um scroll longo difícil de escanear (rótulos
// truncados na lateral). "Autenticação" (4) não precisa.
export const LIMIAR_SUBGRUPO_RECURSO = 10;

// IDs de operação que devem ganhar um cabeçalho de recurso ANTES delas --
// só a 1ª operação de cada recurso novo dentro de uma tag grande. Mesma
// função alimenta a navegação lateral e a coluna de conteúdo, garantindo
// que os dois concordem em onde os subtítulos aparecem.
export function operacoesComCabecalhoDeRecurso(
  grupos: Map<string, OperacaoDoc[]>,
): Set<string> {
  const comCabecalho = new Set<string>();
  for (const operacoes of grupos.values()) {
    if (operacoes.length <= LIMIAR_SUBGRUPO_RECURSO) continue;
    let recursoAnterior: string | null = null;
    for (const operacao of operacoes) {
      if (operacao.recurso !== recursoAnterior) {
        comCabecalho.add(operacao.id);
        recursoAnterior = operacao.recurso;
      }
    }
  }
  return comCabecalho;
}

// Resolve só o formato que o schema real usa pra ref (achado real no
// schema): "$ref" direto, ou "allOf: [{$ref}]" (padrão do drf-spectacular
// pra campo aninhado readOnly). Não resolve oneOf/anyOf combinados de
// verdade -- não aparece nesse schema.
export function resolverSchema(
  doc: OpenApiDocument,
  schema: OpenApiSchema | undefined,
): OpenApiSchema | undefined {
  if (!schema) return undefined;

  const ref = schema.$ref ?? schema.allOf?.[0]?.$ref;
  if (!ref) return schema;

  const nome = ref.replace("#/components/schemas/", "");
  const resolvido = doc.components?.schemas?.[nome];
  if (!resolvido) return schema;

  // allOf: [{$ref}] pode trazer readOnly/nullable no nível de fora (não no
  // schema referenciado) -- mescla em vez de descartar.
  return { ...resolvido, readOnly: schema.readOnly, nullable: schema.nullable };
}

export function nomeDoRef(schema: OpenApiSchema | undefined): string | null {
  const ref = schema?.$ref ?? schema?.allOf?.[0]?.$ref;
  return ref ? ref.replace("#/components/schemas/", "") : null;
}

export function corpoDaOperacao(
  operation: OpenApiOperation,
): { schema: OpenApiSchema; required: boolean } | null {
  const content = operation.requestBody?.content?.["application/json"];
  if (!content?.schema) return null;
  return {
    schema: content.schema,
    required: operation.requestBody?.required ?? false,
  };
}

// 1ª resposta 2xx (ordem numérica) -- é a resposta "de sucesso" que faz
// sentido documentar no exemplo; erros (4xx/5xx) já aparecem descritos à
// parte na tabela de status.
export function respostaDeSucesso(
  operation: OpenApiOperation,
): { status: string; response: OpenApiSchema | null } | null {
  const codigos = Object.keys(operation.responses ?? {})
    .filter((codigo) => codigo.startsWith("2"))
    .sort();
  const status = codigos[0];
  if (!status) return null;
  const schema =
    operation.responses?.[status]?.content?.["application/json"]?.schema ??
    null;
  return { status, response: schema };
}
