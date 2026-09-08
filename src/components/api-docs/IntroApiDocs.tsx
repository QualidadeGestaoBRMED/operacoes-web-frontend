import type { OperacaoDoc } from "@/lib/openapi";
import type { OpenApiDocument } from "@/types/openapi";

const FATOS_RAPIDOS = [
  {
    rotulo: "Autenticação",
    valor: "Bearer JWT",
    legenda: "header Authorization",
  },
  { rotulo: "Formato", valor: "JSON", legenda: "application/json" },
  { rotulo: "Paginação", valor: "?page=N", legenda: "20 por página" },
  { rotulo: "Filtros", valor: "?campo=valor", legenda: "por query string" },
];

// Seção de abertura do conteúdo -- achado direto do usuário testando: sem
// isso, a página caía direto num endpoint (Login com Google) colado no
// cabeçalho, sem nada dizendo do que se trata. Layout de 2 colunas
// (parágrafo + cartão de referência rápida) inspirado na seção "API
// Reference" da Stripe -- sem copiar o que não se aplica aqui (múltiplas
// linguagens de SDK, modo sandbox/live, é fora de escopo da issue).
export function IntroApiDocs({
  doc,
  grupos,
}: {
  doc: OpenApiDocument;
  grupos: Map<string, OperacaoDoc[]>;
}) {
  return (
    <div className="grid gap-8 border-b border-border pt-10 pb-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          Documentação da API do Atlas
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Referência dos endpoints de consulta (GET) da API REST do Atlas. Cada
          um mostra os parâmetros aceitos e um exemplo de resposta gerado a
          partir do schema real da API, o mesmo schema que serve o Swagger em{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">
            /api/docs/
          </code>
          .
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(doc.tags ?? []).map((tag) => {
            const primeiraOperacao = grupos.get(tag.name)?.[0];
            if (!primeiraOperacao) return null;
            return (
              <a
                key={tag.name}
                href={`#${primeiraOperacao.id}`}
                className="rounded-full border border-border bg-muted px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                {tag.name}
              </a>
            );
          })}
        </div>
      </div>

      <div className="h-fit rounded-xl border border-border bg-muted/40 p-6">
        <div className="mb-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Referência rápida
        </div>
        <dl className="flex flex-col gap-4">
          {FATOS_RAPIDOS.map((fato) => (
            <div key={fato.rotulo}>
              <dt className="text-[13px] font-semibold text-muted-foreground">
                {fato.rotulo}
              </dt>
              <dd className="mt-1 font-mono text-base text-foreground">
                {fato.valor}
              </dd>
              <dd className="mt-0.5 text-[13px] text-muted-foreground">
                {fato.legenda}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-[13px] font-semibold text-muted-foreground">
              Versão
            </dt>
            <dd className="mt-1 font-mono text-base text-foreground">
              {doc.info.version}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
