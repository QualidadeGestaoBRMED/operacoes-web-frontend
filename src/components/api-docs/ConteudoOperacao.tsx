import { BadgeMetodo } from "./BadgeMetodo";
import { TabelaAtributos } from "./TabelaAtributos";
import { TextoComMarkdownLeve } from "./TextoComMarkdownLeve";
import {
  atributosDeParametros,
  atributosDoSchema,
} from "@/lib/openapiAtributos";
import { corpoDaOperacao, respostaDeSucesso } from "@/lib/openapi";
import type { OperacaoDoc } from "@/lib/openapi";
import type { OpenApiDocument } from "@/types/openapi";

// Fallback pra quando o schema não preenche `description` da resposta --
// achado no review: o schema real deixa isso em branco em quase todo
// operationId (44 de 45), o que deixava a seção "Respostas" com uma linha
// vazia do lado do código de status na maioria dos endpoints.
const DESCRICAO_PADRAO_STATUS: Record<string, string> = {
  "200": "Requisição bem-sucedida.",
  "201": "Recurso criado com sucesso.",
  "204": "Requisição bem-sucedida, sem conteúdo de resposta.",
  "400": "Dados inválidos ou requisição malformada.",
  "401": "Autenticação necessária ou token inválido/expirado.",
  "403": "Sem permissão para acessar este recurso.",
  "404": "Recurso não encontrado.",
  "429": "Limite de requisições excedido.",
  "500": "Erro interno do servidor.",
};

export function ConteudoOperacao({
  doc,
  operacao,
}: {
  doc: OpenApiDocument;
  operacao: OperacaoDoc;
}) {
  const { operation, path, metodo, id } = operacao;
  // === "query" (não !== "path") -- achado no review: o schema aceita
  // parametro.in "header"/"cookie" também, e esses não são "busca" (a
  // seção abaixo é rotulada "Parâmetros de busca") -- reescrevia a
  // semântica do schema pra "qualquer parâmetro que não seja de path".
  // Nenhum header/cookie existe no schema real hoje (auth Bearer vem do
  // security scheme, não de um parameter), mas o filtro não deveria
  // depender dessa coincidência.
  const parametrosQuery = operation.parameters?.filter(
    (parametro) => parametro.in === "query",
  );
  const corpo = corpoDaOperacao(operation);
  const respostas = Object.entries(operation.responses ?? {});
  // Achado no review: só um objeto nomeado (ex. DocumentoUnidadeRead) já
  // ganha seção própria em "Objetos" -- mas resposta paginada (envelope
  // count/next/previous/results, schema PRÓPRIO gerado pelo
  // drf-spectacular) nunca aparecia documentada em lugar nenhum, só no
  // JSON de exemplo à direita. atributosDoSchema já retorna [] quando o
  // schema resolvido não tem `properties` (ex. resposta é um array solto,
  // sem envelope) -- guard abaixo só evita um título "Corpo da resposta"
  // sem nenhuma linha embaixo nesses casos.
  const sucesso = respostaDeSucesso(operation);
  const atributosResposta = sucesso
    ? atributosDoSchema(doc, sucesso.response ?? undefined)
    : [];

  return (
    <section id={id} className="min-w-0 scroll-mt-24">
      <div className="flex items-center gap-3">
        <BadgeMetodo metodo={metodo} />
        <code className="font-mono text-sm text-muted-foreground">{path}</code>
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">
        {operation.summary ?? id}
      </h2>
      {operation.description && (
        // div, não <p> -- TextoComMarkdownLeve pode renderizar uma lista
        // (<ul>), que não é válida dentro de <p>.
        <div className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          <TextoComMarkdownLeve texto={operation.description} />
        </div>
      )}

      {parametrosQuery && parametrosQuery.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Parâmetros de busca
          </h3>
          <TabelaAtributos
            atributos={atributosDeParametros(doc, parametrosQuery)}
          />
        </div>
      )}

      {corpo && (
        <div className="mt-8">
          <h3 className="mb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Corpo da requisição{corpo.required ? "" : " (opcional)"}
          </h3>
          <TabelaAtributos atributos={atributosDoSchema(doc, corpo.schema)} />
        </div>
      )}

      {respostas.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Respostas
          </h3>
          <div className="flex flex-col gap-2.5">
            {respostas.map(([status, resposta]) => (
              <div key={status} className="flex gap-3 text-[13.5px]">
                <code
                  className={
                    "w-10 shrink-0 font-mono font-semibold " +
                    (status.startsWith("2")
                      ? "text-green-600"
                      : "text-amber-700")
                  }
                >
                  {status}
                </code>
                <span className="leading-relaxed text-muted-foreground">
                  {resposta.description ||
                    DESCRICAO_PADRAO_STATUS[status] ||
                    "Sem descrição."}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {atributosResposta.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Corpo da resposta
          </h3>
          <TabelaAtributos atributos={atributosResposta} />
        </div>
      )}
    </section>
  );
}
