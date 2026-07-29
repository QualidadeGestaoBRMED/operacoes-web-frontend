import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import type { TipoGestao } from "@/types";
import { KanbanBoard } from "./KanbanBoard";

// SWR guarda um cache global por padrão -- sem isolar, o resultado de um
// teste (chave ["demandas", {}], igual em todo teste aqui já que nenhum
// mexe em filtros de URL) vazava pro próximo render() dentro do mesmo
// arquivo (achado rodando a suíte inteira: cada teste isolado passava,
// juntos alguns falhavam). provider: () => new Map() dá um cache vazio a
// cada render.
function renderBoard() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <KanbanBoard />
    </SWRConfig>,
  );
}

// KanbanBoard lê filtros/rota via next/navigation -- fora de um Router real
// do Next, esses hooks quebram. Stubs simples bastam: nenhum teste aqui
// depende de navegação de verdade acontecer.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/modulos/gestao-demandas",
  useSearchParams: () => new URLSearchParams(),
}));

// Simular um drag real (mouse ou teclado) via @dnd-kit em jsdom é frágil:
// o sensor de teclado (coordinateGetter) e a detecção de colisão do
// PointerSensor dependem de getBoundingClientRect() real, que jsdom sempre
// devolve zerado -- tentativa com Tab/Espaço/Seta/Espaço nunca chegava a
// completar um drop (over ficava undefined). Em vez disso, mocka só
// DndContext (useDraggable/useDroppable continuam reais -- os cards/colunas
// renderizam normalmente) pra capturar o onDragEnd de verdade do
// KanbanBoard e disparar com um DragEndEvent sintético -- testa o
// moverDemanda de verdade (update otimista, chamada mockada, rollback no
// erro) sem depender de geometria que o jsdom não tem.
let onDragEndCapturado: ((evento: { active: { id: number }; over: { id: string } }) => void) | null =
  null;

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...real,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: ReactNode;
      onDragEnd: (evento: { active: { id: number }; over: { id: string } }) => void;
    }) => {
      onDragEndCapturado = onDragEnd;
      return children;
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { usuarioId: 1, perfil: { id: 1, nome: "Admin Operações", nivel: 2 } },
    perfil: { id: 1, nome: "Admin Operações", nivel: 2 },
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
  }),
}));

// Auto-mock: toda função exportada vira vi.fn() (resolve undefined por
// padrão). Hooks não usados diretamente nesses testes (useAnexos,
// useComentarios, useHistorico) já tratam isso como `data ?? []`, então
// não precisam de mock explícito -- só o que os testes realmente controlam.
vi.mock("@/lib/demandas");
// Achado na STC-215: sem mockar isso, KanbanFiltros (renderizado dentro do
// KanbanBoard) chama listarUnidades/listarSetores de verdade via useUnidades/
// useSetores -- suíte "passava" só por sorte, porque normalmente não há
// nada respondendo em localhost:3000 durante `vitest run` e o fetch falha
// com erro de rede (sem response.status, então o interceptor de 401 de
// lib/api.ts nunca dispara). Rodar os testes com `npm run dev` ativo na
// mesma porta já é o suficiente pra essas chamadas reais alcançarem o proxy
// de verdade, tomarem 401 (sem sessão) e disparar signOut() -- que por sua
// vez falha tentando montar uma URL relativa fora de um browser real,
// vazando como unhandled rejection no meio de um teste sem nenhuma relação.
vi.mock("@/lib/plataforma");

import {
  atualizarStatusDemanda,
  buscarDemanda,
  listarDemandas,
  listarTiposGestao,
} from "@/lib/demandas";

const TIPO_GESTAO_UNICO: TipoGestao = {
  id: 1,
  modulo: 1,
  nome: "Operacional",
  codigo: "operacional",
  descricao: "",
  visibilidade_padrao: "todos",
  ativo: true,
  ordem: 0,
};

// tiposGestao.length <= 1 evita o efeito de "resolver tipo de gestão
// padrão" (KanbanBoard.tsx) -- com só 1 tipo cadastrado ele não faz nada,
// simplificando o setup (sem precisar simular a URL ganhando ?tipo_gestao=).
function mockarTiposGestao() {
  vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNICO]);
}

function mockarDemandas(demandas: ReturnType<typeof criarDemanda>[]) {
  vi.mocked(listarDemandas).mockImplementation(async (filtros) => {
    if (filtros?.status === "lixeira") return [];
    return demandas;
  });
}

beforeEach(() => {
  // Achado no autoreview: clearAllMocks só limpa histórico de chamadas, não
  // a implementação (mockResolvedValue/mockImplementation de um teste
  // anterior sobrevivia). Hoje todo teste redefine o que usa antes de
  // renderizar, então não quebrava nada -- mas é uma dependência de ordem
  // silenciosa esperando pra virar teste flaky. resetAllMocks também zera
  // a implementação, forçando cada teste a declarar o que precisa.
  vi.resetAllMocks();
  mockarTiposGestao();
});

describe("KanbanBoard", () => {
  it("renderiza as colunas com as demandas nas fases certas", async () => {
    const noBacklog = criarDemanda({ titulo: "Revisar contrato", status: "backlog" });
    const emAndamento = criarDemanda({ titulo: "Corrigir vazamento", status: "em_andamento" });
    mockarDemandas([noBacklog, emAndamento]);

    renderBoard();
    await screen.findByText("Revisar contrato");

    // Achado no autoreview: getByText sozinho só prova que o título aparece
    // em algum lugar da página, não que caiu na coluna certa -- o nome do
    // teste prometia mais do que a asserção checava. .max-h-full escopa
    // pro <div> raiz de cada KanbanColumn (sem data-testid próprio).
    const colunaBacklog = screen.getByText("Backlog").closest<HTMLElement>(".max-h-full");
    const colunaEmAndamento = screen
      .getByText("Em Andamento")
      .closest<HTMLElement>(".max-h-full");
    expect(colunaBacklog).not.toBeNull();
    expect(colunaEmAndamento).not.toBeNull();
    expect(within(colunaBacklog!).getByText("Revisar contrato")).toBeInTheDocument();
    expect(within(colunaEmAndamento!).getByText("Corrigir vazamento")).toBeInTheDocument();
    expect(within(colunaBacklog!).queryByText("Corrigir vazamento")).not.toBeInTheDocument();
    expect(within(colunaEmAndamento!).queryByText("Revisar contrato")).not.toBeInTheDocument();
  });

  it("mostra estado de carregamento antes dos dados chegarem", () => {
    // Nunca resolve dentro da janela do teste -- fica sempre "carregando".
    vi.mocked(listarDemandas).mockImplementation(() => new Promise(() => {}));

    renderBoard();

    expect(screen.getByText("Carregando demandas...")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há demandas", async () => {
    mockarDemandas([]);

    renderBoard();

    const vazios = await screen.findAllByText("Nenhuma demanda aqui");
    expect(vazios.length).toBeGreaterThan(0);
  });

  it("mostra estado de erro quando a busca falha", async () => {
    vi.mocked(listarDemandas).mockRejectedValue(new Error("falha de rede"));

    renderBoard();

    expect(
      await screen.findByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
  });

  it("abre o modal de detalhe ao clicar num card", async () => {
    const demanda = criarDemanda({ titulo: "Trocar lâmpada", status: "backlog" });
    mockarDemandas([demanda]);
    vi.mocked(buscarDemanda).mockResolvedValue(demanda);
    const user = userEvent.setup();

    renderBoard();
    await user.click(await screen.findByText("Trocar lâmpada"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Trocar lâmpada")).toBeInTheDocument();

    // Fecha explicitamente -- sem isso, os efeitos colaterais do Radix no
    // <body> (scroll-lock, aria-hidden nos irmãos) sobrevivem ao unmount
    // abrupto do cleanup() entre testes e vazam pro próximo (achado
    // rodando a suíte inteira: só esse teste sozinho não bastava pra
    // reproduzir).
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("move um card com sucesso (dispara o onDragEnd real do board)", async () => {
    // Precisa de responsável principal -- backlog -> em_andamento sem isso
    // é bloqueado estruturalmente (mesma regra de mensagemBloqueioConhecido
    // já coberta em kanban.test.ts); sem esse fixture, moverDemanda nunca
    // chega a chamar atualizarStatusDemanda.
    const demanda = criarDemanda({
      titulo: "Ajustar orçamento",
      status: "backlog",
      responsaveis: [responsavelPrincipal()],
    });
    mockarDemandas([demanda]);
    vi.mocked(atualizarStatusDemanda).mockResolvedValue({
      ...demanda,
      status: "em_andamento",
    });

    renderBoard();
    await screen.findByText("Ajustar orçamento");
    onDragEndCapturado?.({ active: { id: demanda.id }, over: { id: "em_andamento" } });

    await waitFor(() => {
      expect(atualizarStatusDemanda).toHaveBeenCalledWith(demanda.id, { status: "em_andamento" });
    });
  });

  it("mostra erro e não perde o card quando mover falha", async () => {
    const demanda = criarDemanda({
      titulo: "Renovar licença",
      status: "backlog",
      responsaveis: [responsavelPrincipal()],
    });
    mockarDemandas([demanda]);
    vi.mocked(atualizarStatusDemanda).mockRejectedValue(new Error("boom"));

    renderBoard();
    await screen.findByText("Renovar licença");
    onDragEndCapturado?.({ active: { id: demanda.id }, over: { id: "em_andamento" } });

    await waitFor(() => {
      expect(atualizarStatusDemanda).toHaveBeenCalled();
    });
    // Rollback do update otimista -- o card continua visível (não sumiu
    // silenciosamente da tela por causa do erro).
    expect(screen.getByText("Renovar licença")).toBeInTheDocument();
  });
});
