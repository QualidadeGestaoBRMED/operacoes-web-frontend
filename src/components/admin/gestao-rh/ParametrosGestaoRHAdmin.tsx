"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FERIAS_ATIVA } from "@/config/gestaoRH";
import { AbaImportacao } from "./AbaImportacao";
import { FormParametrosAbsenteismo } from "./FormParametrosAbsenteismo";
import { FormReguaFerias } from "./FormReguaFerias";

const CLASSE_ABA = "flex-none rounded-none px-1 text-sm data-[state=active]:shadow-none";

/**
 * Seção "Parâmetros de Gestão RH" da Administração (só Admin). Abre na aba
 * de parâmetros (absenteísmo e, com FERIAS_ATIVA, a régua de férias), a única
 * ligada à API; a de Importação mostra o
 * formulário desligado até a fonte dos dados ser definida. Abas sublinhadas,
 * como no detalhe do documento da Legalização; seções empilhadas na largura
 * toda, como as outras seções da Administração.
 */
type AbaParametros = "importacao" | "absenteismo-ferias";

export function ParametrosGestaoRHAdmin({ hidden }: { hidden?: boolean }) {
  const [aba, setAba] = useState<AbaParametros>("absenteismo-ferias");

  // Aba inativa só escondida (forceMount + hidden), não desmontada: trocar
  // de aba não descarta uma edição em andamento, mesmo motivo do `hidden`
  // das seções da Administração.
  return (
    // overflow-y-auto também corta na horizontal: sem a folga de 1 (px-1,
    // compensada por -mx-1), o anel de foco dos campos encostados nas bordas
    // (limite de atraso à esquerda, faixa crítica à direita) era cortado.
    <div hidden={hidden} className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
      <Tabs
        value={aba}
        onValueChange={(valor) => setAba(valor as AbaParametros)}
        className="gap-6"
      >
        <TabsList
          variant="line"
          className="h-11 w-full justify-start gap-5 rounded-none border-b border-border bg-transparent"
        >
          <TabsTrigger value="importacao" className={CLASSE_ABA}>
            Importação
          </TabsTrigger>
          <TabsTrigger value="absenteismo-ferias" className={CLASSE_ABA}>
            {FERIAS_ATIVA ? "Absenteísmo e férias" : "Absenteísmo"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importacao" forceMount hidden={aba !== "importacao"}>
          <AbaImportacao />
        </TabsContent>

        <TabsContent
          value="absenteismo-ferias"
          forceMount
          hidden={aba !== "absenteismo-ferias"}
          className="space-y-7"
        >
          <FormParametrosAbsenteismo />
          {FERIAS_ATIVA && (
            <>
              <Separator />
              <FormReguaFerias />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
