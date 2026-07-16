"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertCircle, X } from "lucide-react";
import { useDemandas } from "@/hooks/useDemandas";
import { atualizarStatusDemanda, excluirDemanda, listarDemandas, restaurarDemanda } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { Demanda, DemandaFiltros, Prioridade, StatusDemanda } from "@/types";
import { DemandaCardArrastando } from "./DemandaCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanFiltros } from "./KanbanFiltros";

const COLUNAS: { status: StatusDemanda; titulo: string }[] = [
  { status: "backlog", titulo: "Backlog" },
  { status: "em_andamento", titulo: "Em Andamento" },
  { status: "em_revisao", titulo: "Em Revisão" },
  { status: "concluido", titulo: "Concluído" },
  { status: "lixeira", titulo: "Lixeira" },
];

function filtrosDaUrl(searchParams: URLSearchParams): DemandaFiltros {
  const filtros: DemandaFiltros = {};
  const unidade = searchParams.get("unidade");
  const prioridade = searchParams.get("prioridade");
  const search = searchParams.get("search");
  if (unidade) filtros.unidade = Number(unidade);
  if (prioridade) filtros.prioridade = prioridade as Prioridade;
  if (search) filtros.search = search;
  return filtros;
}

export function KanbanBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtros = filtrosDaUrl(searchParams);

  const { demandas: demandasAtivas, isLoading, error, mensagemErro, mutate } = useDemandas(filtros);
  // O backend exclui a lixeira por padrão em qualquer listagem sem filtro
  // (STC-178) -- só enxerga itens excluídos quando ?status=lixeira é
  // passado explicitamente. Por isso a coluna Lixeira precisa da própria
  // busca, separada da busca das colunas ativas.
  const filtrosLixeira: DemandaFiltros = { ...filtros, status: "lixeira" };
  const {
    demandas: demandasLixeira,
    isLoading: isLoadingLixeira,
    mutate: mutateLixeira,
  } = useDemandas(filtrosLixeira);
  const [erroMovimento, setErroMovimento] = useState<string | null>(null);
  const [demandaArrastando, setDemandaArrastando] = useState<Demanda | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function atualizarFiltrosNaUrl(novosFiltros: DemandaFiltros) {
    const params = new URLSearchParams();
    if (novosFiltros.unidade) params.set("unidade", String(novosFiltros.unidade));
    if (novosFiltros.prioridade) params.set("prioridade", novosFiltros.prioridade);
    if (novosFiltros.search) params.set("search", novosFiltros.search);
    router.replace(params.size > 0 ? `?${params.toString()}` : "?");
  }

  async function moverDemanda(demanda: Demanda, novoStatus: StatusDemanda) {
    if (demanda.status === novoStatus) return;
    setErroMovimento(null);

    // "lixeira" fica fora do endpoint de status de propósito no backend
    // (soft delete via DELETE, não PATCH .../status/) e mora numa lista
    // separada (demandasLixeira) -- então sair de "ativas" e revalidar
    // "lixeira" à parte, em vez de só trocar o status no mesmo array.
    if (novoStatus === "lixeira") {
      const dadosOtimistas = demandasAtivas.filter((item) => item.id !== demanda.id);
      try {
        await mutate(excluirDemanda(demanda.id).then(() => listarDemandas(filtros)), {
          optimisticData: dadosOtimistas,
          rollbackOnError: true,
          revalidate: false,
        });
        void mutateLixeira();
      } catch (erro) {
        setErroMovimento(extrairMensagemErro(erro));
      }
      return;
    }

    const dadosOtimistas = demandasAtivas.map((item) =>
      item.id === demanda.id ? { ...item, status: novoStatus } : item,
    );

    try {
      await mutate(
        atualizarStatusDemanda(demanda.id, { status: novoStatus }).then(() => listarDemandas(filtros)),
        { optimisticData: dadosOtimistas, rollbackOnError: true, revalidate: false },
      );
    } catch (erro) {
      // Backend é a fonte de verdade: se a transição não for permitida (ex.:
      // faltando responsável principal ou aprovador), o mutate() já desfez o
      // movimento visual sozinho (rollbackOnError) -- só falta mostrar o motivo.
      setErroMovimento(extrairMensagemErro(erro));
    }
  }

  async function restaurar(demanda: Demanda) {
    setErroMovimento(null);
    const dadosOtimistas = demandasLixeira.filter((item) => item.id !== demanda.id);
    try {
      await mutateLixeira(restaurarDemanda(demanda.id).then(() => listarDemandas(filtrosLixeira)), {
        optimisticData: dadosOtimistas,
        rollbackOnError: true,
        revalidate: false,
      });
      void mutate();
    } catch (erro) {
      setErroMovimento(extrairMensagemErro(erro));
    }
  }

  function handleDragStart(evento: DragStartEvent) {
    // Cards na lixeira não são arrastáveis (useDraggable disabled), então só
    // demandasAtivas pode ser a origem de um drag.
    setDemandaArrastando(demandasAtivas.find((item) => item.id === evento.active.id) ?? null);
  }

  function handleDragEnd(evento: DragEndEvent) {
    setDemandaArrastando(null);
    const { active, over } = evento;
    if (!over) return;
    const demanda = demandasAtivas.find((item) => item.id === active.id);
    if (!demanda) return;
    void moverDemanda(demanda, over.id as StatusDemanda);
  }

  function selecionarDemanda(demanda: Demanda) {
    // Abrir o modal de detalhe é escopo da STC-168 -- por enquanto, sem ação.
    void demanda;
  }

  return (
    <div className="flex h-full flex-col">
      <KanbanFiltros
        filtros={filtros}
        onMudarFiltros={atualizarFiltrosNaUrl}
        onNovaDemanda={() => {
          // Formulário de nova demanda é escopo da STC-167.
        }}
      />

      {erroMovimento && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-7 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {erroMovimento}
          <button
            type="button"
            onClick={() => setErroMovimento(null)}
            className="ml-auto"
            aria-label="Dispensar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemErro}
        </div>
      ) : isLoading || isLoadingLixeira ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Carregando demandas...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDemandaArrastando(null)}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto p-5">
            {COLUNAS.map((coluna) => (
              <KanbanColumn
                key={coluna.status}
                status={coluna.status}
                titulo={coluna.titulo}
                demandas={
                  coluna.status === "lixeira"
                    ? demandasLixeira
                    : demandasAtivas.filter((demanda) => demanda.status === coluna.status)
                }
                onSelecionarDemanda={selecionarDemanda}
                onRestaurar={restaurar}
              />
            ))}
          </div>
          <DragOverlay>
            {demandaArrastando ? <DemandaCardArrastando demanda={demandaArrastando} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
