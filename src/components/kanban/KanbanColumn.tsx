"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Demanda, StatusDemanda } from "@/types";
import { DemandaCard } from "./DemandaCard";

interface KanbanColumnProps {
  status: StatusDemanda;
  titulo: string;
  demandas: Demanda[];
  onSelecionarDemanda: (demanda: Demanda) => void;
  onRestaurar: (demanda: Demanda) => void;
}

export function KanbanColumn({
  status,
  titulo,
  demandas,
  onSelecionarDemanda,
  onRestaurar,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex max-h-full min-w-60 flex-1 flex-col rounded-lg bg-muted/45 transition-colors",
        isOver && "bg-secondary/10 ring-2 ring-secondary/40",
      )}
      style={{ flexBasis: 264, maxWidth: 340 }}
    >
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          {titulo}
          <span className="rounded-full bg-card px-2 py-px text-[11.5px] font-semibold text-muted-foreground">
            {demandas.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        {demandas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-muted-foreground">
            <Inbox className="size-6" />
            <span className="text-[13px] font-semibold text-foreground">Nenhuma demanda aqui</span>
          </div>
        ) : (
          demandas.map((demanda) => (
            <DemandaCard
              key={demanda.id}
              demanda={demanda}
              onClick={onSelecionarDemanda}
              onRestaurar={onRestaurar}
            />
          ))
        )}
      </div>
    </div>
  );
}
