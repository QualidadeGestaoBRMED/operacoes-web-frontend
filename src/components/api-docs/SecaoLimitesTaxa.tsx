import {
  celulaEhCodigo,
  extrairTabelaMarkdown,
  textoDaCelula,
} from "@/lib/markdownTabela";

export const ID_LIMITES_TAXA = "limites-taxa";

// Puxa a tabela real de backend/core/settings/base.py
// (SPECTACULAR_SETTINGS.DESCRIPTION, seção "## Limites de taxa") em vez de
// reescrever os números à mão aqui -- fonte de fato é o schema (mesmo
// princípio já usado no resto da página), não uma cópia que pode
// dessincronizar depois.
export function SecaoLimitesTaxa({
  descricao,
}: {
  descricao: string | undefined;
}) {
  const linhas = extrairTabelaMarkdown(descricao);
  if (!linhas || linhas.length < 2) return null;

  const [cabecalho, ...corpo] = linhas;

  return (
    <section id={ID_LIMITES_TAXA} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold text-foreground">
        Limites de taxa
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Alguns endpoints têm limite de requisições por usuário/IP -- ao
        estourar, a resposta vem com status{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">
          429
        </code>
        .
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              {cabecalho.map((titulo) => (
                <th
                  key={titulo}
                  className="px-4 py-2.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                >
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corpo.map((linha, indice) => (
              <tr key={indice} className="border-b border-border last:border-0">
                {linha.map((celula, indiceCelula) => (
                  <td
                    key={indiceCelula}
                    className="px-4 py-3 text-muted-foreground"
                  >
                    {celulaEhCodigo(celula) ? (
                      <code className="font-mono text-[13px] text-foreground">
                        {textoDaCelula(celula)}
                      </code>
                    ) : (
                      celula
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
