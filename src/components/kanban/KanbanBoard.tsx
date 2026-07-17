"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { useDemandas } from "@/hooks/useDemandas";
import { atualizarStatusDemanda, excluirDemanda, listarDemandas, restaurarDemanda } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import {
  COLUNAS,
  ORDEM_COLUNAS,
  compararDemandas,
  filtrosDaUrl,
  mensagemBloqueioConhecido,
  passaNoFoco,
} from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { Demanda, DemandaFiltros, StatusDemanda } from "@/types";
import { DemandaCardArrastando } from "./DemandaCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanFiltros } from "./KanbanFiltros";
import { ResumoCards } from "./ResumoCards";

export function KanbanBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtros = filtrosDaUrl(searchParams);

  const {
    demandas: demandasAtivas,
    isValidating,
    carregandoPrimeiraVez,
    error,
    mensagemErro,
    mutate,
  } = useDemandas(filtros);
  // O backend exclui a lixeira por padrão em qualquer listagem sem filtro
  // (STC-178) -- só enxerga itens excluídos quando ?status=lixeira é
  // passado explicitamente. Por isso a coluna Lixeira precisa da própria
  // busca, separada da busca das colunas ativas.
  const filtrosLixeira: DemandaFiltros = { ...filtros, status: "lixeira" };
  const {
    demandas: demandasLixeira,
    isValidating: isValidatingLixeira,
    carregandoPrimeiraVez: carregandoLixeiraPrimeiraVez,
    mutate: mutateLixeira,
  } = useDemandas(filtrosLixeira);
  const [demandaArrastando, setDemandaArrastando] = useState<Demanda | null>(null);
  // Rótulo da estatística clicada nos cards de KPI ("atrasadas"/"sem
  // responsável") -- clicar de novo no mesmo card desliga o filtro.
  const [foco, setFoco] = useState<string | null>(null);

  // Índice da coluna "virtual" atual durante um arraste por teclado --
  // precisa ser estado mutável entre teclas, não recalculado do zero a
  // cada uma. Achado no code review: a versão anterior lia sempre a coluna
  // ORIGINAL do card (que nunca muda durante o arraste), então repetir a
  // mesma seta nunca avançava além da coluna adjacente à origem.
  const indiceColunaArrastandoRef = useRef<number | null>(null);

  // KeyboardSensor: Tab até o card, Espaço/Enter pega, setas movem entre
  // colunas, Espaço/Enter solta, Esc cancela -- sem isso, mover uma demanda
  // de fase só era possível com mouse/touch (a interação central do board
  // inteiro ficava inacessível por teclado). Setas pulam direto pra fase
  // seguinte/anterior a partir da coluna virtual ATUAL (não da original),
  // avançando um passo por tecla.
  const coordenadasPorFase: KeyboardCoordinateGetter = (event, { context }) => {
    if (indiceColunaArrastandoRef.current === null) return undefined;

    let indiceAlvo: number | undefined;
    if (event.code === KeyboardCode.Right) indiceAlvo = indiceColunaArrastandoRef.current + 1;
    if (event.code === KeyboardCode.Left) indiceAlvo = indiceColunaArrastandoRef.current - 1;
    if (indiceAlvo === undefined || indiceAlvo < 0 || indiceAlvo >= ORDEM_COLUNAS.length) {
      return undefined;
    }

    const rect = context.droppableRects.get(ORDEM_COLUNAS[indiceAlvo]);
    if (!rect) return undefined;

    indiceColunaArrastandoRef.current = indiceAlvo;
    event.preventDefault();
    return { x: rect.left, y: rect.top };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasPorFase }),
  );

  function nomeColuna(status: string) {
    return COLUNAS.find((coluna) => coluna.status === status)?.titulo ?? status;
  }

  const anuncios: Announcements = {
    onDragStart({ active }) {
      const demanda = demandasAtivas.find((item) => item.id === active.id);
      return `Arrastando a demanda "${demanda?.titulo ?? active.id}".`;
    },
    onDragOver({ over }) {
      if (!over) return "Fora de qualquer coluna.";
      return `Sobre a coluna ${nomeColuna(String(over.id))}.`;
    },
    onDragEnd({ active, over }) {
      const demanda = demandasAtivas.find((item) => item.id === active.id);
      if (!over) return `Movimento cancelado para "${demanda?.titulo ?? active.id}".`;
      return `Demanda "${demanda?.titulo ?? active.id}" solta na coluna ${nomeColuna(String(over.id))}.`;
    },
    onDragCancel({ active }) {
      const demanda = demandasAtivas.find((item) => item.id === active.id);
      return `Movimento cancelado para "${demanda?.titulo ?? active.id}".`;
    },
  };

  function atualizarFiltrosNaUrl(novosFiltros: DemandaFiltros) {
    const params = new URLSearchParams();
    if (novosFiltros.unidade) params.set("unidade", String(novosFiltros.unidade));
    if (novosFiltros.prioridade) params.set("prioridade", novosFiltros.prioridade);
    if (novosFiltros.categoria) params.set("categoria", String(novosFiltros.categoria));
    if (novosFiltros.search) params.set("search", novosFiltros.search);
    router.replace(params.size > 0 ? `?${params.toString()}` : "?");
  }

  async function moverDemanda(demanda: Demanda, novoStatus: StatusDemanda) {
    if (demanda.status === novoStatus) return;

    const bloqueio = mensagemBloqueioConhecido(demanda, novoStatus);
    if (bloqueio) {
      // Já sabemos que essa transição vai falhar -- nem tenta mover o
      // card visualmente (dnd-kit já devolve ele pro lugar sozinho).
      toast.error(bloqueio);
      return;
    }

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
        toast.error(extrairMensagemErro(erro));
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
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function restaurar(demanda: Demanda) {
    const dadosOtimistas = demandasLixeira.filter((item) => item.id !== demanda.id);
    try {
      await mutateLixeira(restaurarDemanda(demanda.id).then(() => listarDemandas(filtrosLixeira)), {
        optimisticData: dadosOtimistas,
        rollbackOnError: true,
        revalidate: false,
      });
      void mutate();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  function handleDragStart(evento: DragStartEvent) {
    // Cards na lixeira não são arrastáveis (useDraggable disabled), então só
    // demandasAtivas pode ser a origem de um drag.
    const demanda = demandasAtivas.find((item) => item.id === evento.active.id) ?? null;
    setDemandaArrastando(demanda);
    indiceColunaArrastandoRef.current = demanda ? ORDEM_COLUNAS.indexOf(demanda.status) : null;
  }

  function handleDragEnd(evento: DragEndEvent) {
    setDemandaArrastando(null);
    indiceColunaArrastandoRef.current = null;
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
    <div className="flex h-full min-h-0 flex-col">
      <ResumoCards
        filtros={filtros}
        focoAtivo={foco}
        onFocoClick={(rotulo) => setFoco((atual) => (atual === rotulo ? null : rotulo))}
      />

      <KanbanFiltros
        filtros={filtros}
        onMudarFiltros={atualizarFiltrosNaUrl}
        onNovaDemanda={() => {
          // Formulário de nova demanda é escopo da STC-167.
        }}
      />

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemErro}
        </div>
      ) : carregandoPrimeiraVez || carregandoLixeiraPrimeiraVez ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Carregando demandas...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements: anuncios,
            screenReaderInstructions: {
              draggable:
                "Para pegar uma demanda, pressione a barra de espaço. " +
                "Arrastando, use as setas do teclado para mover entre as colunas. " +
                "Pressione espaço de novo para soltar na nova coluna, ou esc para cancelar.",
            },
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setDemandaArrastando(null);
            indiceColunaArrastandoRef.current = null;
          }}
        >
          {/* justify-center: as colunas têm maxWidth (340px) e param de
              crescer bem antes de preencher telas largas -- sem centralizar,
              a sobra de espaço toda ficava jogada à direita. opacity: troca
              de filtro mantém os cards antigos (keepPreviousData no hook)
              em vez de colapsar pra "Carregando demandas..." -- só esmaece
              um pouco enquanto a resposta nova não chega. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 justify-center gap-4 overflow-x-auto p-5 transition-opacity",
              (isValidating || isValidatingLixeira) && "opacity-60",
            )}
          >
            {COLUNAS.map((coluna) => (
              <KanbanColumn
                key={coluna.status}
                status={coluna.status}
                titulo={coluna.titulo}
                demandas={
                  coluna.status === "lixeira"
                    ? demandasLixeira.slice().sort(compararDemandas)
                    : demandasAtivas
                        .filter((demanda) => demanda.status === coluna.status)
                        .filter((demanda) => passaNoFoco(demanda, foco))
                        .sort(compararDemandas)
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
