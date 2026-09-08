"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormCadastrarDocumento } from "./FormCadastrarDocumento";
import { FormNovaVersaoRegra } from "./FormNovaVersaoRegra";
import { TabelaTiposDocumento } from "./TabelaTiposDocumento";

export function CatalogoLegalizacaoAdmin() {
  const [formCadastroAberto, setFormCadastroAberto] = useState(false);

  return (
    <div className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto">
      <TabelaTiposDocumento />

      <Separator />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Cadastrar documento na unidade
          </h2>
          <p className="text-sm text-muted-foreground">
            Monta o esqueleto de um tipo de documento para uma unidade -- regra,
            status inicial e evidência num único fluxo.
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => setFormCadastroAberto(true)}
        >
          <Plus className="size-4" />
          Cadastrar documento
        </Button>
      </div>

      <Separator />

      <FormNovaVersaoRegra />

      <FormCadastrarDocumento
        open={formCadastroAberto}
        onOpenChange={setFormCadastroAberto}
      />
    </div>
  );
}
