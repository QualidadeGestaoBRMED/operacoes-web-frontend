"use client";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaImportacao } from "./AbaImportacao";
import { FormParametrosAbsenteismo } from "./FormParametrosAbsenteismo";
import { FormReguaFerias } from "./FormReguaFerias";

/**
 * Seção "Parâmetros de Gestão RH" da Administração (só Admin). Abre na aba
 * Absenteísmo e férias, a única ligada à API; a de Importação mostra o
 * formulário desligado até a fonte dos dados ser definida.
 */
export function ParametrosGestaoRHAdmin({ hidden }: { hidden?: boolean }) {
  return (
    <div hidden={hidden} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Tabs defaultValue="absenteismo-ferias" className="gap-5">
        <TabsList>
          <TabsTrigger value="importacao">Importação</TabsTrigger>
          <TabsTrigger value="absenteismo-ferias">Absenteísmo e férias</TabsTrigger>
        </TabsList>

        <TabsContent value="importacao" className="max-w-3xl">
          <AbaImportacao />
        </TabsContent>

        <TabsContent value="absenteismo-ferias" className="max-w-3xl space-y-7">
          <FormParametrosAbsenteismo />
          <Separator />
          <FormReguaFerias />
        </TabsContent>
      </Tabs>
    </div>
  );
}
