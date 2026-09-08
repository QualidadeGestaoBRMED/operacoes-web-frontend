import { Badge } from "@/components/ui/badge";
import { idObjeto } from "@/lib/openapiAtributos";
import type { AtributoLinha } from "@/lib/openapiAtributos";
import { TextoComMarkdownLeve } from "./TextoComMarkdownLeve";

export function TabelaAtributos({ atributos }: { atributos: AtributoLinha[] }) {
  if (atributos.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <tbody>
          {atributos.map((atributo) => (
            <tr
              key={atributo.nome}
              className="border-b border-border last:border-0"
            >
              <td className="w-1/3 align-top px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="font-mono text-[13px] font-semibold text-foreground">
                    {atributo.nome}
                  </code>
                  {atributo.refNome ? (
                    <a
                      href={`#${idObjeto(atributo.refNome)}`}
                      className="text-xs text-secondary underline-offset-2 hover:underline"
                    >
                      {atributo.tipo}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {atributo.tipo}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {atributo.obrigatorio && (
                    <Badge variant="outline" className="text-[10px]">
                      obrigatório
                    </Badge>
                  )}
                  {atributo.somenteLeitura && (
                    <Badge variant="muted" className="text-[10px]">
                      somente leitura
                    </Badge>
                  )}
                  {atributo.nullable && (
                    <Badge variant="muted" className="text-[10px]">
                      pode ser null
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3.5 leading-relaxed text-muted-foreground">
                <TextoComMarkdownLeve texto={atributo.descricao} />
                {atributo.valoresEnum && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {atributo.valoresEnum.map((valor) => (
                      <code
                        key={valor}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {valor}
                      </code>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
