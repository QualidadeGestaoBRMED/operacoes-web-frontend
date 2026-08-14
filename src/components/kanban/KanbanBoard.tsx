"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { DetalheCard } from "@/components/demanda/DetalheCard";
import { FormNovaDemanda } from "@/components/demanda/FormNovaDemanda";
import { useAuth } from "@/hooks/useAuth";
import { useDemandas } from "@/hooks/useDemandas";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { atualizarStatusDemanda, excluirDemanda, restaurarDemanda } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import {
  COLUNAS,
  ORDEM_COLUNAS,
  compararDemandas,
  filtrosDaUrl,
  hojeNoFusoDoServidor,
  mensagemBloqueioConhecido,
  passaNoFoco,
  secaoDoBloqueio,
} from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { Demanda, DemandaFiltros, StatusDemanda } from "@/types";
import { DemandaCardArrastando } from "./DemandaCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanFiltros } from "./KanbanFiltros";
import { ResumoCards } from "./ResumoCards";
import { TipoGestaoTabs } from "./TipoGestaoTabs";

export function KanbanBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filtros = filtrosDaUrl(searchParams);
  const { tiposGestao, isLoading: carregandoTipos } = useTiposGestao();
  const { user, isAdminOps } = useAuth();

  // tipo_gestao troca o board inteiro (STC-182), então sempre precisa de UM
  // selecionado -- nunca "todos". Se a URL não trouxer nenhum (1º acesso,
  // ou um link antigo sem o parâmetro) e existir mais de um tipo cadastrado,
  // escolhe o primeiro por "ordem" assim que a lista carregar. Com 0 ou 1
  // tipo, não faz nada -- comportamento atual (sem filtro) preservado.
  //
  // Achado em dogfooding (junto da correção de visibilidade do
  // TipoGestaoViewSet): a URL pode trazer um tipo_gestao que EXISTIA mas
  // deixou de ser válido pra esse usuário -- link/aba antiga de antes de
  // uma mudança de visibilidade_padrao, por exemplo. Sem checar isso, o
  // efeito via filtros.tipo_gestao "preenchido" e não fazia nada; o board
  // filtrava por um tipo que o backend nunca devolve pra esse usuário
  // (0 resultado) e, com 1 tipo só sobrando, TipoGestaoTabs nem renderiza
  // nada -- sem nenhuma aba visível pra escolher outro valor manualmente.
  // Mesma classe de bug já achada num Select da STC-205 (value sem opção
  // correspondente).
  const tipoGestaoAtualEhValido = tiposGestao.some((tipo) => tipo.id === filtros.tipo_gestao);
  useEffect(() => {
    if (carregandoTipos || tipoGestaoAtualEhValido) return;
    if (tiposGestao.length <= 1) {
      if (filtros.tipo_gestao) atualizarFiltrosNaUrl({ ...filtros, tipo_gestao: undefined });
      return;
    }
    atualizarFiltrosNaUrl({ ...filtros, tipo_gestao: tiposGestao[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoTipos, tiposGestao, filtros.tipo_gestao, tipoGestaoAtualEhValido]);

  // Cobre toda a janela entre "o board monta" e "o tipo_gestao padrão foi
  // escrito na URL" -- precisa ser calculada ANTES dos useDemandas/
  // useResumoDemandas abaixo pra poder desabilitá-los enquanto isso não
  // resolve (ver comentário em useDemandas.ts sobre por que desabilitar a
  // busca, e não só esconder o resultado, é o que realmente fecha a corrida).
  const resolvendoTipoGestaoPadrao =
    !filtros.tipo_gestao && (carregandoTipos || tiposGestao.length > 1);

  const [demandaArrastando, setDemandaArrastando] = useState<Demanda | null>(null);
  // Também cobre a mutação disparada pelo drop, não só o gesto visual de
  // arrastar -- ver comentário em moverDemanda.
  const [movimentoPendente, setMovimentoPendente] = useState(false);
  // STC-206: pausa o polling do board (e dos KPIs) enquanto uma demanda está
  // sendo arrastada -- um refresh em segundo plano no meio do drag-and-drop
  // (@dnd-kit) reordenaria os cards debaixo do cursor.
  const pausarPolling = demandaArrastando !== null || movimentoPendente;

  const {
    demandas: demandasAtivas,
    isFilterChangeValidating,
    carregandoPrimeiraVez,
    error,
    mensagemErro,
    mutate,
  } = useDemandas(filtros, { pausado: pausarPolling, desabilitado: resolvendoTipoGestaoPadrao });
  // O backend exclui a lixeira por padrão em qualquer listagem sem filtro
  // (STC-178) -- só enxerga itens excluídos quando ?status=lixeira é
  // passado explicitamente. Por isso a coluna Lixeira precisa da própria
  // busca, separada da busca das colunas ativas.
  const filtrosLixeira: DemandaFiltros = { ...filtros, status: "lixeira" };
  const {
    demandas: demandasLixeira,
    isFilterChangeValidating: isFilterChangeValidatingLixeira,
    carregandoPrimeiraVez: carregandoLixeiraPrimeiraVez,
    error: erroLixeira,
    mensagemErro: mensagemErroLixeira,
    mutate: mutateLixeira,
  } = useDemandas(filtrosLixeira, {
    pausado: pausarPolling,
    desabilitado: resolvendoTipoGestaoPadrao,
  });
  // Rótulo da estatística clicada nos cards de KPI ("atrasadas"/"sem
  // responsável") -- clicar de novo no mesmo card desliga o filtro.
  const [foco, setFoco] = useState<string | null>(null);
  // Modal de detalhe (STC-168) -- guarda só o id, não a Demanda inteira: o
  // DetalheCard busca a própria via useDemanda(id), sempre com dado fresco
  // (a cópia na lista pode estar desatualizada se algo mudou fora do board).
  const [demandaSelecionadaId, setDemandaSelecionadaId] = useState<number | null>(null);
  // STC-203: quando um drag-and-drop bloqueado abre o modal automaticamente,
  // guarda qual seção/destino resolve o bloqueio -- só é aplicado enquanto
  // demandaId bater com demandaSelecionadaId (ver uso no <DetalheCard>
  // abaixo), pra não "grudar" numa reabertura por clique normal depois.
  const [aberturaBloqueio, setAberturaBloqueio] = useState<{
    demandaId: number;
    secao: "status" | "responsavel";
    statusAlvo?: StatusDemanda;
  } | null>(null);
  const [formNovaDemandaAberto, setFormNovaDemandaAberto] = useState(false);

  // Notificações (STC-169) linkam pra cá como "?demanda=<id>" -- abre o
  // modal de detalhe automaticamente. A limpeza do parâmetro fica pro
  // fechamento do modal (abaixo), não aqui: um router.replace() disparado
  // na mesma janela do router.push() que trouxe o parâmetro (NotificacoesMenu)
  // não pegava -- a URL ficava presa em "?demanda=X" mesmo depois do
  // replace "rodar". Limpar só no fechamento, como reação a uma ação real
  // do usuário, evita essa corrida.
  useEffect(() => {
    const idParam = searchParams.get("demanda");
    if (!idParam) return;
    const id = Number(idParam);
    if (Number.isNaN(id)) return;
    setDemandaSelecionadaId(id);
  }, [searchParams]);

  // Antes cada coluna filtrava+ordenava a lista inteira de novo dentro do
  // JSX (5 passagens completas a cada render do board). Agrupa tudo numa
  // única passagem aqui, memoizado -- só recalcula quando os dados ou o
  // foco realmente mudam.
  const demandasPorColuna = useMemo(() => {
    const grupos = new Map<StatusDemanda, Demanda[]>(COLUNAS.map((coluna) => [coluna.status, []]));
    for (const demanda of demandasAtivas) {
      if (!passaNoFoco(demanda, foco)) continue;
      grupos.get(demanda.status)?.push(demanda);
    }
    for (const lista of grupos.values()) {
      lista.sort(compararDemandas);
    }
    grupos.set("lixeira", demandasLixeira.slice().sort(compararDemandas));
    return grupos;
  }, [demandasAtivas, demandasLixeira, foco]);

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

  // Achado na auditoria de responsividade (STC-186), com uma volta atrás no
  // meio do caminho: a 1ª tentativa (MouseSensor + TouchSensor com
  // delay/tolerance) resolvia "rolar rápido a coluna funciona", mas ainda
  // quebrava um caso real -- um toque que fica parado por >200ms antes de
  // começar a mover (comportamento normal de um arraste devagar e
  // deliberado, exatamente como o mouse do DevTools simula toque) arma o
  // drag de qualquer jeito, e a partir daí nenhum movimento seguinte vira
  // scroll, por mais devagar que seja -- baseado em TEMPO, não em direção
  // do gesto. A correção de verdade fica no touch-action do card (ver
  // DemandaCard.tsx: touch-pan-y no lugar de touch-none): deixa o navegador
  // decidir pela DIREÇÃO do gesto, não por tempo -- um toque que começa
  // predominantemente vertical vira scroll nativo sempre, não importa
  // velocidade nem quanto tempo o dedo ficou parado antes. Movimento
  // horizontal/diagonal (o único jeito de mudar uma demanda de coluna de
  // verdade, já que as colunas ficam lado a lado) continua livre pro
  // PointerSensor de sempre -- não precisa mais separar mouse de toque.
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
    if (novosFiltros.tipo_gestao) params.set("tipo_gestao", String(novosFiltros.tipo_gestao));
    if (novosFiltros.unidade) params.set("unidade", String(novosFiltros.unidade));
    if (novosFiltros.setor) params.set("setor", String(novosFiltros.setor));
    if (novosFiltros.prioridade) params.set("prioridade", novosFiltros.prioridade);
    if (novosFiltros.categoria) params.set("categoria", String(novosFiltros.categoria));
    if (novosFiltros.search) params.set("search", novosFiltros.search);
    router.replace(params.size > 0 ? `?${params.toString()}` : "?");
  }

  async function moverDemanda(demanda: Demanda, novoStatus: StatusDemanda) {
    if (demanda.status === novoStatus) return;

    // Achado no review: sem passar isAdminOps/usuarioId, o bloqueio só
    // considerava a estrutura da transição -- um usuário sem permissão em
    // em_revisao->em_andamento recebia o toast de "justificativa
    // obrigatória, use Mudar status", mas essa opção nem aparece pra ele
    // (TransicaoStatusSection filtra pelo mesmo critério de permissão).
    const bloqueio = mensagemBloqueioConhecido(demanda, novoStatus, isAdminOps, user?.usuarioId);
    if (bloqueio) {
      // Já sabemos que essa transição vai falhar -- nem tenta mover o
      // card visualmente (dnd-kit já devolve ele pro lugar sozinho).
      toast.error(bloqueio);
      // STC-203: além do toast, abre o modal já na seção que resolve o
      // bloqueio (com o destino pré-selecionado, se for de status) -- em
      // vez de deixar o usuário refazer tudo manualmente.
      const secao = secaoDoBloqueio(demanda, novoStatus, isAdminOps, user?.usuarioId);
      if (secao) {
        setAberturaBloqueio({
          demandaId: demanda.id,
          secao,
          statusAlvo: secao === "status" ? novoStatus : undefined,
        });
        setDemandaSelecionadaId(demanda.id);
      }
      return;
    }

    // Achado no review: demandaArrastando (e por tabela pausarPolling) já
    // volta a false assim que o card é solto, ANTES dessa função sequer
    // começar -- ou seja, o polling do board reativava bem no meio da
    // janela entre o update otimista abaixo e a confirmação do backend. Um
    // poll calhando de cair nesse intervalo buscava o estado antigo e
    // sobrescrevia o otimista por um instante (card "piscando" de volta
    // pra coluna anterior). setMovimentoPendente mantém o polling pausado
    // até essa mutação específica assentar, não só até o gesto de arrastar
    // visualmente terminar.
    setMovimentoPendente(true);
    try {
      // "lixeira" fica fora do endpoint de status de propósito no backend
      // (soft delete via DELETE, não PATCH .../status/) e mora numa lista
      // separada (demandasLixeira) -- então sair de "ativas" e revalidar
      // "lixeira" à parte, em vez de só trocar o status no mesmo array.
      if (novoStatus === "lixeira") {
        const dadosOtimistas = demandasAtivas.filter((item) => item.id !== demanda.id);
        // Achado no review: antes a mutação e o refetch (listarDemandas) iam
        // juntos numa Promise só, com rollbackOnError -- se a exclusão desse
        // certo no backend mas só o refetch falhasse (timeout, 500), o SWR
        // desfazia o card visualmente mesmo já excluído de verdade. Agora o
        // rollback (mutate() sem args, buscando o estado real) só roda se a
        // mutação em si falhar; sucesso da exclusão sempre mantém o otimista
        // e revalida as duas listas à parte, sem acoplar o resultado de uma à
        // da outra.
        mutate(dadosOtimistas, { revalidate: false });
        try {
          await excluirDemanda(demanda.id);
        } catch (erro) {
          toast.error(extrairMensagemErro(erro));
          void mutate();
          return;
        }
        void mutate();
        void mutateLixeira();
        return;
      }

      // Achado em autorevisão: o backend também seta data_conclusao ao
      // entrar em "concluido" (único jeito de chegar aqui via drag direto,
      // sem passar pelo modal, é em_revisao->concluido -- as outras
      // transições pra "concluido" exigem justificativa/aprovador e sempre
      // bloqueiam o drag antes de chegar aqui, ver mensagemBloqueioConhecido
      // acima). Sem espelhar isso no otimista, o card mostrava a coluna
      // certa mas sem nenhuma data de conclusão até a revalidação chegar
      // (DemandaCard/InfoPrazo só renderiza a linha "concluída em" quando
      // data_conclusao existe).
      const dadosOtimistas = demandasAtivas.map((item) =>
        item.id === demanda.id
          ? {
              ...item,
              status: novoStatus,
              data_conclusao:
                novoStatus === "concluido" ? hojeNoFusoDoServidor() : item.data_conclusao,
            }
          : item,
      );

      mutate(dadosOtimistas, { revalidate: false });
      try {
        await atualizarStatusDemanda(demanda.id, { status: novoStatus });
      } catch (erro) {
        // Backend é a fonte de verdade: se a transição não for permitida (ex.:
        // faltando responsável principal ou aprovador), revalida pra buscar o
        // estado real (em vez de só reverter pro cache anterior) e mostra o motivo.
        toast.error(extrairMensagemErro(erro));
        void mutate();
        return;
      }
      void mutate();
    } finally {
      setMovimentoPendente(false);
    }
  }

  async function restaurar(demanda: Demanda) {
    const dadosOtimistas = demandasLixeira.filter((item) => item.id !== demanda.id);
    mutateLixeira(dadosOtimistas, { revalidate: false });
    try {
      await restaurarDemanda(demanda.id);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
      void mutateLixeira();
      return;
    }
    void mutateLixeira();
    void mutate();
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
    setDemandaSelecionadaId(demanda.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TipoGestaoTabs
        tiposGestao={tiposGestao}
        valorSelecionado={filtros.tipo_gestao}
        onMudar={(tipoGestaoId) =>
          // unidade/area_responsavel são mutuamente exclusivos por tipo de
          // gestão (Operacional usa area_responsavel, os demais usam
          // unidade) -- sem limpar os dois ao trocar de aba, um filtro
          // escolhido antes da troca (pro campo que já não aparece mais no
          // seletor) continuava aplicado, silenciosamente zerando o board.
          atualizarFiltrosNaUrl({
            ...filtros,
            tipo_gestao: tipoGestaoId,
            unidade: undefined,
            area_responsavel: undefined,
          })
        }
      />

      <ResumoCards
        filtros={filtros}
        focoAtivo={foco}
        onFocoClick={(rotulo) => setFoco((atual) => (atual === rotulo ? null : rotulo))}
        pausarPolling={pausarPolling}
        desabilitado={resolvendoTipoGestaoPadrao}
      />

      <KanbanFiltros
        filtros={filtros}
        onMudarFiltros={atualizarFiltrosNaUrl}
        onNovaDemanda={() => setFormNovaDemandaAberto(true)}
      />

      {error || erroLixeira ? (
        // Achado no code review: só o erro da lista ativa era checado --
        // se só a busca da lixeira falhasse, o board inteiro ficava preso
        // em "Carregando demandas..." pra sempre, escondendo até os dados
        // que já tinham chegado.
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemErro ?? mensagemErroLixeira}
        </div>
      ) : carregandoPrimeiraVez || carregandoLixeiraPrimeiraVez || resolvendoTipoGestaoPadrao ? (
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
          {/* justify-content:safe center (não justify-center puro): as
              colunas têm maxWidth (340px) e param de crescer bem antes de
              preencher telas largas -- sem centralizar, a sobra de espaço
              toda ficava jogada à direita. Achado na auditoria de
              responsividade (STC-186): com as 5 colunas não cabendo mais
              (basta a sidebar estar aberta num notebook comum, ~1440px já é
              suficiente), um justify-center comum deixa a coluna Backlog
              parcialmente fora da área de scroll e IRRECUPERÁVEL --
              scrollLeft não vai abaixo de 0, então esse recorte nunca é
              alcançável arrastando pra esquerda (confirmado medindo
              getBoundingClientRect() antes/depois). "safe" (CSS Box
              Alignment L3) é o fallback do próprio spec pra isso: centraliza
              quando cabe, cai pra alinhamento ao início quando não cabe, sem
              nunca cortar conteúdo fora do alcance do scroll. opacity: troca
              de filtro mantém os cards antigos (keepPreviousData no hook)
              em vez de colapsar pra "Carregando demandas..." -- só esmaece
              um pouco enquanto a resposta nova não chega. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 [justify-content:safe_center] gap-4 overflow-x-auto p-5 transition-opacity",
              (isFilterChangeValidating || isFilterChangeValidatingLixeira) && "opacity-60",
            )}
          >
            {COLUNAS.map((coluna) => (
              <KanbanColumn
                key={coluna.status}
                status={coluna.status}
                titulo={coluna.titulo}
                demandas={demandasPorColuna.get(coluna.status) ?? []}
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

      <DetalheCard
        demandaId={demandaSelecionadaId}
        secaoInicial={
          aberturaBloqueio?.demandaId === demandaSelecionadaId ? aberturaBloqueio.secao : undefined
        }
        statusAlvoInicial={
          aberturaBloqueio?.demandaId === demandaSelecionadaId
            ? aberturaBloqueio.statusAlvo
            : undefined
        }
        onOpenChange={(open) => {
          if (open) return;
          setDemandaSelecionadaId(null);
          setAberturaBloqueio(null);
          // Limpa o "?demanda=" deixado por uma notificação (STC-169) ao
          // fechar -- sem isso, um F5 reabriria o modal sozinho de novo.
          // Achado no review do Tech Lead: monta a partir do pathname atual
          // em vez de só "?" quando não sobra nenhum parâmetro -- "?" sozinho
          // é ambíguo (URL relativa à query atual, não necessariamente a
          // raiz da página).
          if (searchParams.has("demanda")) {
            const params = new URLSearchParams(searchParams);
            params.delete("demanda");
            router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
          }
        }}
      />
      <FormNovaDemanda
        open={formNovaDemandaAberto}
        onOpenChange={setFormNovaDemandaAberto}
        tipoGestaoInicial={filtros.tipo_gestao}
      />
    </div>
  );
}
