"use client";

import { useState } from "react";
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
import type { Demanda, DemandaFiltros, Prioridade, StatusDemanda } from "@/types";
import { DemandaCardArrastando } from "./DemandaCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanFiltros } from "./KanbanFiltros";
import { ResumoCards } from "./ResumoCards";

const COLUNAS: { status: StatusDemanda; titulo: string }[] = [
  { status: "backlog", titulo: "Backlog" },
  { status: "em_andamento", titulo: "Em Andamento" },
  { status: "em_revisao", titulo: "Em Revisão" },
  { status: "concluido", titulo: "Concluído" },
  { status: "lixeira", titulo: "Lixeira" },
];

const ORDEM_COLUNAS = COLUNAS.map((coluna) => coluna.status);

const PESO_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

// Antes vinha só na ordem que o backend devolve (-created_at, "mais
// recente primeiro") -- ninguém tinha escolhido isso de propósito pro
// board. Prazo mais próximo primeiro (o que precisa de atenção logo)
// desempatado por prioridade é mais operacional que ordem de criação.
function compararDemandas(a: Demanda, b: Demanda): number {
  const prazoDiff = new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
  if (prazoDiff !== 0) return prazoDiff;
  return PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
}

// Padrão do KeyboardSensor move um cursor virtual em pixels e depende da
// detecção de colisão pra "adivinhar" a coluna mais próxima -- impreciso
// pra colunas fixas lado a lado. Aqui seta direita/esquerda pula direto
// pra fase seguinte/anterior na ordem do board, sem ambiguidade nenhuma.
const coordenadasPorFase: KeyboardCoordinateGetter = (event, { context }) => {
  const statusAtual = context.active?.data.current?.status as StatusDemanda | undefined;
  if (!statusAtual) return undefined;

  const indiceAtual = ORDEM_COLUNAS.indexOf(statusAtual);
  if (indiceAtual === -1) return undefined;

  let indiceAlvo: number | undefined;
  if (event.code === KeyboardCode.Right) indiceAlvo = indiceAtual + 1;
  if (event.code === KeyboardCode.Left) indiceAlvo = indiceAtual - 1;
  if (indiceAlvo === undefined || indiceAlvo < 0 || indiceAlvo >= ORDEM_COLUNAS.length) {
    return undefined;
  }

  const rect = context.droppableRects.get(ORDEM_COLUNAS[indiceAlvo]);
  if (!rect) return undefined;

  event.preventDefault();
  return { x: rect.left, y: rect.top };
};

// Transições que o backend sempre rejeita hoje porque exigem um dado que
// o drag-and-drop do board não coleta (aprovador_id/justificativa -- isso
// é a mini-formulário da rota "completa" discutida, ainda não construída).
// Bloquear aqui ANTES do optimistic update evita o floop visual de mover o
// card, a coluna se reorganizar, e tudo voltar de novo alguns instantes
// depois quando o rollback chega.
const TRANSICOES_SEM_DADO_COLETADO = new Set([
  "em_andamento->em_revisao",
  "em_andamento->backlog",
  "em_revisao->em_andamento",
  "em_revisao->backlog",
  "concluido->em_andamento",
  "concluido->backlog",
]);

// Mesmo critério do backend (ResumoView) pras métricas "atrasadas"/"sem
// responsável" -- clicar no card de KPI usa isso como atalho de filtro
// rápido no board, sem precisar de um filtro dedicado (nem de refazer a
// consulta: os dados já estão carregados no client).
function passaNoFoco(demanda: Demanda, foco: string | null): boolean {
  if (!foco) return true;
  if (demanda.status === "concluido") return false;

  if (foco === "atrasadas") {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(`${demanda.data_prevista}T00:00:00`) < hoje;
  }
  if (foco === "sem responsável") {
    return !demanda.responsaveis.some((r) => r.tipo === "principal");
  }
  return true;
}

function mensagemBloqueioConhecido(demanda: Demanda, novoStatus: StatusDemanda): string | null {
  if (TRANSICOES_SEM_DADO_COLETADO.has(`${demanda.status}->${novoStatus}`)) {
    return novoStatus === "em_revisao"
      ? "Selecione um aprovador para enviar à revisão."
      : "Justificativa obrigatória para essa transição.";
  }

  if (demanda.status === "backlog" && novoStatus === "em_andamento") {
    const temPrincipal = demanda.responsaveis.some((r) => r.tipo === "principal");
    if (!temPrincipal) return "Defina um responsável principal antes de iniciar a execução.";
  }

  return null;
}

function filtrosDaUrl(searchParams: URLSearchParams): DemandaFiltros {
  const filtros: DemandaFiltros = {};
  const unidade = searchParams.get("unidade");
  const prioridade = searchParams.get("prioridade");
  const categoria = searchParams.get("categoria");
  const search = searchParams.get("search");
  if (unidade) filtros.unidade = Number(unidade);
  if (prioridade) filtros.prioridade = prioridade as Prioridade;
  if (categoria) filtros.categoria = Number(categoria);
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
  const [demandaArrastando, setDemandaArrastando] = useState<Demanda | null>(null);
  // Rótulo da estatística clicada nos cards de KPI ("atrasadas"/"sem
  // responsável") -- clicar de novo no mesmo card desliga o filtro.
  const [foco, setFoco] = useState<string | null>(null);

  // KeyboardSensor: Tab até o card, Espaço/Enter pega, setas movem entre
  // colunas, Espaço/Enter solta, Esc cancela -- sem isso, mover uma demanda
  // de fase só era possível com mouse/touch (a interação central do board
  // inteiro ficava inacessível por teclado).
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
      ) : isLoading || isLoadingLixeira ? (
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
          onDragCancel={() => setDemandaArrastando(null)}
        >
          {/* justify-center: as colunas têm maxWidth (340px) e param de
              crescer bem antes de preencher telas largas -- sem centralizar,
              a sobra de espaço toda ficava jogada à direita. */}
          <div className="flex min-h-0 flex-1 justify-center gap-4 overflow-x-auto p-5">
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
