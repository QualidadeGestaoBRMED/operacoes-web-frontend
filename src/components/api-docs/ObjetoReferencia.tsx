import { atributosDoSchema, idObjeto } from "@/lib/openapiAtributos";
import { TabelaAtributos } from "./TabelaAtributos";
import type { OpenApiDocument } from "@/types/openapi";

// Seção própria por objeto (não só uma linha "unidade: Unidade" numa
// tabela de endpoint) -- achado no review comparando com a Stripe: todo
// objeto referenciado por nome (Unidade, TipoDocumentoRegulatorio...)
// precisa de um lugar próprio explicando os campos dele, senão o link da
// tabela de atributos não leva a lugar nenhum.
export function ObjetoReferencia({
  doc,
  nome,
}: {
  doc: OpenApiDocument;
  nome: string;
}) {
  const atributos = atributosDoSchema(doc, {
    $ref: `#/components/schemas/${nome}`,
  });

  return (
    <section id={idObjeto(nome)} className="min-w-0 scroll-mt-24">
      <h2 className="text-2xl font-semibold text-foreground">{nome}</h2>
      <p className="mt-2 max-w-2xl text-[13.5px] text-muted-foreground">
        Objeto retornado por um ou mais endpoints acima.
      </p>
      <div className="mt-6">
        <TabelaAtributos atributos={atributos} />
      </div>
    </section>
  );
}
