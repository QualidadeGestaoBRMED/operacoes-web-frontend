"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnidades } from "@/hooks/useUnidades";
import type { DemandaFiltros, Prioridade } from "@/types";

const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: "urgente", rotulo: "Urgente" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "media", rotulo: "Média" },
  { valor: "baixa", rotulo: "Baixa" },
];

interface KanbanFiltrosProps {
  filtros: DemandaFiltros;
  onMudarFiltros: (filtros: DemandaFiltros) => void;
  onNovaDemanda: () => void;
}

export function KanbanFiltros({ filtros, onMudarFiltros, onNovaDemanda }: KanbanFiltrosProps) {
  const { unidades } = useUnidades();
  // Busca com debounce local -- não dispara um filtro (e um fetch) a cada
  // tecla, só 300ms depois que o usuário parar de digitar.
  const [buscaLocal, setBuscaLocal] = useState(filtros.search ?? "");

  useEffect(() => {
    const temporizador = setTimeout(() => {
      if (buscaLocal !== (filtros.search ?? "")) {
        onMudarFiltros({ ...filtros, search: buscaLocal || undefined });
      }
    }, 300);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaLocal]);

  const temFiltrosAtivos = Boolean(filtros.unidade || filtros.prioridade || filtros.search);

  function limparFiltros() {
    setBuscaLocal("");
    onMudarFiltros({});
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-7 py-4">
      <div className="relative w-full max-w-[320px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={buscaLocal}
          onChange={(evento) => setBuscaLocal(evento.target.value)}
          placeholder="Buscar demanda..."
          className="h-9 pl-9"
        />
      </div>

      <Select
        value={filtros.unidade ? String(filtros.unidade) : "todas"}
        onValueChange={(valor) =>
          onMudarFiltros({ ...filtros, unidade: valor === "todas" ? undefined : Number(valor) })
        }
      >
        <SelectTrigger size="sm" className="h-8">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as unidades</SelectItem>
          {unidades.map((unidade) => (
            <SelectItem key={unidade.id} value={String(unidade.id)}>
              {unidade.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.prioridade ?? "todas"}
        onValueChange={(valor) =>
          onMudarFiltros({
            ...filtros,
            prioridade: valor === "todas" ? undefined : (valor as Prioridade),
          })
        }
      >
        <SelectTrigger size="sm" className="h-8">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as prioridades</SelectItem>
          {PRIORIDADES.map((prioridade) => (
            <SelectItem key={prioridade.valor} value={prioridade.valor}>
              {prioridade.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {temFiltrosAtivos && (
        <button
          type="button"
          onClick={limparFiltros}
          className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
        >
          <X className="size-3.5" />
          Limpar filtros
        </button>
      )}

      <Button className="ml-auto" onClick={onNovaDemanda} disabled title="Em breve">
        Nova Demanda
      </Button>
    </div>
  );
}
