"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormCadastrarDocumento } from "./FormCadastrarDocumento";
import { FormCadastrarDocumentosEmLote } from "./FormCadastrarDocumentosEmLote";
import { FormNovaVersaoRegra } from "./FormNovaVersaoRegra";
import { TabelaTiposDocumento } from "./TabelaTiposDocumento";

export function CatalogoLegalizacaoAdmin({ hidden }: { hidden?: boolean }) {
  const [formCadastroAberto, setFormCadastroAberto] = useState(false);
  const [formLoteAberto, setFormLoteAberto] = useState(false);

  return (
    // hidden (não desmontar): achado na revisão de código -- essa aba era
    // renderizada condicionalmente ({aba === "..." && <CatalogoLegalizacaoAdmin />}
    // em PermissoesAdmin.tsx), diferente da aba "Usuários" (só escondida via
    // `hidden`). Trocar de aba e voltar desmontava e descartava qualquer
    // formulário/filtro em andamento aqui, sem aviso -- agora segue o mesmo
    // padrão da aba irmã.
    //
    // Desktop: sem overflow-y-auto aqui de propósito -- mesmo padrão de
    // PermissoesAdmin.tsx (seção "Usuários"): só a tabela de Tipos de
    // documento rola de verdade (flex-1 min-h, altura medida por
    // useAlturaSemLinhaCortada dentro dela), os outros 2 blocos ficam com
    // shrink-0 (altura natural, nunca comprimida). Um scroll de página por
    // cima da tabela já rolando sozinha criava 2 scrolls disputando o mesmo
    // gesto -- achado no dogfooding visual/mobile.
    //
    // Mobile: não sobra altura pra encaixar tabela + os outros 2 blocos
    // numa tela curta -- a tabela mostra tudo (sem altura travada, ver
    // TabelaTiposDocumento.tsx) e quem rola é a aba inteira.
    <div
      hidden={hidden}
      className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto sm:overflow-visible"
    >
      {/* min-h-[26rem] (não 20rem): achado testando em celular real
          (STC-505) -- 320px só cabia cabeçalho + 1 linha antes de precisar
          rolar dentro da própria tabela, apertado demais pra bater o olho
          rápido em mais de um tipo de documento. 416px cabe 2 linhas
          completas (mesmo critério de piso do resto da tela -- ver
          min-h-[20rem] do PermissoesAdmin.tsx, também calibrado à mão
          olhando o resultado real). O scroll continua sendo da tabela em
          si (overflow-x-auto força overflow-y junto, de propósito -- é o
          que permite ver o resto das linhas), não da aba inteira. */}
      <div className="min-h-[26rem] min-w-0 flex-1">
        <TabelaTiposDocumento />
      </div>

      <Separator className="shrink-0" />

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Cadastrar documento na unidade
          </h2>
          <p className="text-sm text-muted-foreground">
            Cadastra um tipo de documento para uma unidade, com prazo, status
            inicial e evidência, tudo em uma única etapa. Pra cadastrar
            vários itens de um tipo com múltiplas instâncias de uma vez (ex.:
            um documento de calibração por equipamento), use o cadastro em
            lote -- mesma regra pra todos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setFormLoteAberto(true)}
          >
            <Plus className="size-4" />
            Cadastrar em lote
          </Button>
          <Button onClick={() => setFormCadastroAberto(true)}>
            <Plus className="size-4" />
            Cadastrar documento
          </Button>
        </div>
      </div>

      <Separator className="shrink-0" />

      <div className="shrink-0">
        <FormNovaVersaoRegra />
      </div>

      <FormCadastrarDocumento
        open={formCadastroAberto}
        onOpenChange={setFormCadastroAberto}
      />
      <FormCadastrarDocumentosEmLote
        open={formLoteAberto}
        onOpenChange={setFormLoteAberto}
      />
    </div>
  );
}
