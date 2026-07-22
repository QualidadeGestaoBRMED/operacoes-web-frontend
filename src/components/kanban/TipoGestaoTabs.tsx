"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TipoGestao } from "@/types";

interface TipoGestaoTabsProps {
  tiposGestao: TipoGestao[];
  valorSelecionado: number | undefined;
  onMudar: (tipoGestaoId: number) => void;
}

// Diferente dos filtros de Unidade/Setor/Prioridade (que combinam com "E" e
// tem opção "todas"), tipo_gestao troca o board inteiro -- sempre existe
// exatamente um selecionado, nunca "todos". Por isso vive como abas, acima
// da barra de filtros, e não como mais um Select ali dentro.
export function TipoGestaoTabs({ tiposGestao, valorSelecionado, onMudar }: TipoGestaoTabsProps) {
  // Sem sentido escolher entre uma única opção -- mesmo critério já usado
  // pro filtro de Categoria em KanbanFiltros.
  if (tiposGestao.length <= 1) return null;

  return (
    <div className="border-b border-border px-7 pt-4">
      <Tabs
        value={valorSelecionado ? String(valorSelecionado) : undefined}
        onValueChange={(valor) => onMudar(Number(valor))}
      >
        <TabsList variant="line">
          {tiposGestao.map((tipo) => (
            <TabsTrigger key={tipo.id} value={String(tipo.id)}>
              {tipo.nome}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
