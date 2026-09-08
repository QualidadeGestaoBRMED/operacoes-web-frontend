import { BlocoCodigo } from "./BlocoCodigo";
import { valorSintetico } from "@/lib/openapiExemplo";
import type { OpenApiDocument } from "@/types/openapi";

export function PainelObjeto({
  doc,
  nome,
}: {
  doc: OpenApiDocument;
  nome: string;
}) {
  const exemplo = valorSintetico(doc, { $ref: `#/components/schemas/${nome}` });

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-xl bg-primary p-5">
      <div className="text-[11px] font-bold tracking-wide text-primary-foreground/60 uppercase">
        Exemplo
      </div>
      <BlocoCodigo codigo={JSON.stringify(exemplo, null, 2)} />
    </div>
  );
}
