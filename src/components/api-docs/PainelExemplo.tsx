"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeMetodo } from "./BadgeMetodo";
import { BlocoCodigo } from "./BlocoCodigo";
import {
  exemploDeRequestBody,
  exemploDeResposta,
  gerarCurl,
  gerarFetch,
  pathComExemplo,
} from "@/lib/openapiExemplo";
import type { OperacaoDoc } from "@/lib/openapi";
import type { OpenApiDocument } from "@/types/openapi";

export function PainelExemplo({
  doc,
  operacao,
}: {
  doc: OpenApiDocument;
  operacao: OperacaoDoc;
}) {
  const { curl, fetchJs, resposta } = useMemo(() => {
    const path = pathComExemplo(operacao.path, operacao.operation.parameters);
    const corpoRequest = exemploDeRequestBody(doc, operacao.operation);
    return {
      corpoRequest,
      curl: gerarCurl({ metodo: operacao.metodo, path, corpo: corpoRequest }),
      fetchJs: gerarFetch({
        metodo: operacao.metodo,
        path,
        corpo: corpoRequest,
      }),
      resposta: exemploDeResposta(doc, operacao.operation),
    };
  }, [doc, operacao]);

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-primary p-5">
      <div className="flex items-center gap-2">
        <BadgeMetodo metodo={operacao.metodo} className="bg-white/15" />
        <code className="truncate font-mono text-[12.5px] text-primary-foreground/80">
          {operacao.path}
        </code>
      </div>

      <Tabs defaultValue="curl">
        <TabsList className="bg-white/10">
          <TabsTrigger
            value="curl"
            className="text-primary-foreground data-[state=active]:text-foreground"
          >
            cURL
          </TabsTrigger>
          <TabsTrigger
            value="fetch"
            className="text-primary-foreground data-[state=active]:text-foreground"
          >
            fetch (JS)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="curl">
          <BlocoCodigo codigo={curl} />
        </TabsContent>
        <TabsContent value="fetch">
          <BlocoCodigo codigo={fetchJs} />
        </TabsContent>
      </Tabs>

      {resposta && (
        <div>
          <div className="mb-1.5 text-[11px] font-bold tracking-wide text-primary-foreground/60 uppercase">
            Resposta {resposta.status}
          </div>
          <BlocoCodigo codigo={JSON.stringify(resposta.corpo, null, 2)} />
        </div>
      )}
    </div>
  );
}
