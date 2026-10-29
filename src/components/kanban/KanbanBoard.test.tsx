import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import type { Demanda, StatusDemanda, TipoGestao } from "@/types";
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
// do Next, esses hooks quebram. useRouter/useSearchParams viram vi.fn() (não
// um valor fixo) porque os testes de tipo_gestao inválido na URL precisam
// simular uma URL de entrada específica e inspecionar o que o board escreve
// de volta -- os outros testes deste arquivo continuam com o default vazio
// (resetado a cada teste no beforeEach).
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/gestao-demandas",
  useSearchParams: vi.fn(),
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

import { useRouter, useSearchParams } from "next/navigation";
import {
  atualizarStatusDemanda,
  buscarDemanda,
  buscarPrimeiraPaginaDaFase,
  buscarResumoDemandas,
  juntarSemRepetir,
  listarPaginasExtrasDaFase,
  listarTiposGestao,
} from "@/lib/demandas";

const { juntarSemRepetir: juntarDeVerdade } =
  await vi.importActual<typeof import("@/lib/demandas")>("@/lib/demandas");

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

const TIPO_GESTAO_A: TipoGestao = { ...TIPO_GESTAO_UNICO, id: 1, codigo: "operacional" };
const TIPO_GESTAO_B: TipoGestao = {
  ...TIPO_GESTAO_UNICO,
  id: 2,
  nome: "Unidades",
  codigo: "unidades",
  visibilidade_padrao: "unidade",
  ordem: 1,
};

// tiposGestao.length <= 1 evita o efeito de "resolver tipo de gestão
// padrão" (KanbanBoard.tsx) -- com só 1 tipo cadastrado ele não faz nada,
// simplificando o setup (sem precisar simular a URL ganhando ?tipo_gestao=).
function mockarTiposGestao() {
  vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNICO]);
}

// router.replace mockado à parte (não descartável a cada render como o
// resto de useRouter()) -- os testes de tipo_gestao inválido precisam
// inspecionar exatamente o que o board tentou escrever na URL.
const substituirUrl = vi.fn();
const navegarPush = vi.fn();

// Cada coluna busca a própria fase (STC-931): a primeira página de uma fase
// são as demandas daquele status, sem página seguinte.
function daFase(demandas: Demanda[], status: StatusDemanda, total?: number) {
  const daColuna = demandas.filter((demanda) => demanda.status === status);
  const count = total ?? daColuna.length;
  return {
    count,
    next: count > daColuna.length ? "https://x/?page=2" : null,
    previous: null,
    results: daColuna,
  };
}

function mockarDemandas(demandas: ReturnType<typeof criarDemanda>[]) {
  vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (_filtros, status) =>
    daFase(demandas, status),
  );
}

beforeEach(() => {
  // Achado no autoreview: clearAllMocks só limpa histórico de chamadas, não
  // a implementação (mockResolvedValue/mockImplementation de um teste
  // anterior sobrevivia). Hoje todo teste redefine o que usa antes de
  // renderizar, então não quebrava nada -- mas é uma dependência de ordem
  // silenciosa esperando pra virar teste flaky. resetAllMocks também zera
  // a implementação, forçando cada teste a declarar o que precisa.
  vi.resetAllMocks();
  vi.mocked(juntarSemRepetir).mockImplementation(juntarDeVerdade);
  mockarTiposGestao();
  // Default equivalente ao antigo mock fixo (URL sem filtro nenhum) -- só
  // os testes de tipo_gestao inválido sobrescrevem useSearchParams.
  vi.mocked(useRouter).mockReturnValue({ replace: substituirUrl, push: navegarPush } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
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
    vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(() => new Promise(() => {}));

    renderBoard();

    expect(screen.getByText("Carregando demandas...")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há demandas", async () => {
    mockarDemandas([]);

    renderBoard();

    const vazios = await screen.findAllByText("Nenhuma demanda aqui");
    expect(vazios.length).toBeGreaterThan(0);
  });

  it("a fase que falha mostra o erro na própria coluna e as outras seguem (STC-931)", async () => {
    const noBacklog = criarDemanda({ titulo: "Card do backlog", status: "backlog" });
    vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (_filtros, status) => {
      if (status === "concluido") throw new Error("falha de rede");
      return daFase([noBacklog], status);
    });
    const user = userEvent.setup();

    renderBoard();

    const concluido = await screen.findByTestId("concluido");
    expect(
      await within(concluido).findByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByText("Card do backlog")).toBeInTheDocument();

    vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (_filtros, status) =>
      daFase([noBacklog], status),
    );
    await user.click(within(concluido).getByRole("button", { name: "Tentar novamente" }));

    expect(await within(concluido).findByText("Nenhuma demanda aqui")).toBeInTheDocument();
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

  it("card espelho de outro módulo (origem_url preenchido) navega direto, sem abrir o modal de demanda (STC-451)", async () => {
    const cardEspelho = criarDemanda({
      titulo: "Renovação -- Dedetização",
      status: "em_andamento",
      origem_url: "/modulos/legalizacao?documento=58",
    });
    mockarDemandas([cardEspelho]);
    const user = userEvent.setup();

    renderBoard();
    await user.click(await screen.findByText("Renovação -- Dedetização"));

    expect(navegarPush).toHaveBeenCalledWith("/modulos/legalizacao?documento=58");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // buscarDemanda (useDemanda, por trás do DetalheCard) nunca deveria ter
    // sido chamado -- clicar num card espelho não abre o modal de demanda
    // nem por um instante.
    expect(buscarDemanda).not.toHaveBeenCalled();
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

  it("o card sai da coluna de origem e entra na de destino na hora, sem duplicar (STC-931)", async () => {
    const demanda = criarDemanda({
      titulo: "Trocar lâmpadas",
      status: "backlog",
      responsaveis: [responsavelPrincipal()],
    });
    mockarDemandas([demanda]);
    // A confirmação do backend nunca chega: o que aparece é só o otimista.
    vi.mocked(atualizarStatusDemanda).mockImplementation(() => new Promise(() => {}));

    renderBoard();
    await screen.findByText("Trocar lâmpadas");
    onDragEndCapturado?.({ active: { id: demanda.id }, over: { id: "em_andamento" } });

    const emAndamento = screen.getByTestId("em_andamento");
    await waitFor(() => expect(within(emAndamento).getByText("Trocar lâmpadas")).toBeInTheDocument());
    expect(within(screen.getByTestId("backlog")).queryByText("Trocar lâmpadas")).not.toBeInTheDocument();
    expect(screen.getAllByText("Trocar lâmpadas")).toHaveLength(1);
  });

  it("cada coluna mostra o total da fase e carrega mais ao pedir (STC-931)", async () => {
    const carregada = criarDemanda({ titulo: "Concluída recente", status: "concluido" });
    const antiga = criarDemanda({ titulo: "Concluída antiga", status: "concluido" });
    vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (_filtros, status) =>
      daFase([carregada], status, status === "concluido" ? 31 : undefined),
    );
    vi.mocked(listarPaginasExtrasDaFase).mockResolvedValue({
      demandas: [antiga],
      ate: 2,
      temMais: false,
    });
    const user = userEvent.setup();

    renderBoard();
    await screen.findByText("Concluída recente");
    const concluido = screen.getByTestId("concluido");
    expect(within(concluido).getByText("31")).toBeInTheDocument();

    await user.click(within(concluido).getByRole("button", { name: "Carregar mais" }));

    await within(concluido).findByText("Concluída antiga");
    expect(listarPaginasExtrasDaFase).toHaveBeenCalledWith(expect.anything(), "concluido", 2, 2);
  });

  it("com o foco dos cartões ligado, não baixa o histórico do Concluído (STC-931)", async () => {
    const atrasada = criarDemanda({
      titulo: "Atrasada no backlog",
      status: "backlog",
      data_prevista: "2000-01-01",
    });
    const antiga = criarDemanda({ titulo: "Concluída", status: "concluido" });
    vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (_filtros, status) =>
      status === "concluido" ? daFase([antiga], status, 103) : daFase([atrasada], status),
    );
    vi.mocked(buscarResumoDemandas).mockResolvedValue({
      estatisticas: [{ valor: "1", rotulo: "atrasadas", atencao: true }],
      insight: "",
    } as never);
    const user = userEvent.setup();

    renderBoard();
    await screen.findByText("Atrasada no backlog");
    const concluido = screen.getByTestId("concluido");
    expect(within(concluido).getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /atrasadas/i }));

    expect(within(concluido).queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    expect(within(concluido).getByText("Nenhuma demanda aqui")).toBeInTheDocument();
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

  // Achado em dogfooding: URL trazendo um tipo_gestao que existiu mas não é
  // mais válido pra esse usuário (ex.: link/aba antigos de antes de uma
  // mudança de visibilidade_padrao) -- o efeito de "resolver tipo padrão"
  // só agia quando a URL vinha vazia, nunca quando vinha com um valor que
  // não corresponde a nenhum tipo da lista atual.
  describe("um tipo de gestão só, sem abas (STC-884)", () => {
    it("Nova Demanda abre com o único tipo já escolhido", async () => {
      const opex: TipoGestao = {
        ...TIPO_GESTAO_UNICO,
        id: 3,
        nome: "OPEX",
        codigo: "opex",
        visibilidade_padrao: "opex",
      };
      vi.mocked(listarTiposGestao).mockResolvedValue([opex]);
      mockarDemandas([]);
      const user = userEvent.setup();

      renderBoard();
      await screen.findAllByText("Nenhuma demanda aqui");
      const [botao] = screen.getAllByRole("button", { name: "Nova Demanda" });
      await user.click(botao);

      const dialogo = await screen.findByRole("dialog");
      expect(within(dialogo).getByLabelText(/Tipo de gestão/)).toHaveTextContent("OPEX");
    });
  });

  describe("tipo_gestao inválido na URL", () => {
    it("limpa da URL quando só resta 1 tipo visível pro usuário", async () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tipo_gestao=999") as never);
      vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNICO]);
      mockarDemandas([]);

      renderBoard();

      await waitFor(() => {
        expect(substituirUrl).toHaveBeenCalledWith("?");
      });
    });

    it("troca pro primeiro tipo válido quando existe mais de um cadastrado", async () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tipo_gestao=999") as never);
      vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_A, TIPO_GESTAO_B]);
      mockarDemandas([]);

      renderBoard();

      await waitFor(() => {
        expect(substituirUrl).toHaveBeenCalledWith(`?tipo_gestao=${TIPO_GESTAO_A.id}`);
      });
    });

    it("não mexe na URL quando o tipo_gestao já é válido", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams(`tipo_gestao=${TIPO_GESTAO_B.id}`) as never,
      );
      vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_A, TIPO_GESTAO_B]);
      mockarDemandas([]);

      renderBoard();

      await screen.findAllByText("Nenhuma demanda aqui");
      expect(substituirUrl).not.toHaveBeenCalled();
    });

    // Achado em dogfooding: useTiposGestao/useDemandas carregam em paralelo,
    // sem ordem garantida -- se demandas resolver primeiro, o board não pode
    // renderizar o conteúdo bruto (todos os tipos misturados) só porque
    // ainda não sabe que existe mais de 1 tipo de gestão.
    it("continua mostrando 'Carregando demandas...' se demandas resolver antes de tipos", async () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      let resolverTipos: (tipos: TipoGestao[]) => void = () => {};
      vi.mocked(listarTiposGestao).mockReturnValue(
        new Promise((resolve) => {
          resolverTipos = resolve;
        }),
      );
      const demanda = criarDemanda({ titulo: "Não deveria aparecer ainda", status: "backlog" });
      mockarDemandas([demanda]);

      renderBoard();

      // Demandas já resolveram (mockarDemandas resolve na hora); tipos
      // ainda não -- sem a correção, o board mostraria o card aqui, sem
      // nenhum filtro de aba aplicado.
      await waitFor(() => {
        expect(screen.getByText("Carregando demandas...")).toBeInTheDocument();
      });
      expect(screen.queryByText("Não deveria aparecer ainda")).not.toBeInTheDocument();

      resolverTipos([TIPO_GESTAO_A, TIPO_GESTAO_B]);

      await waitFor(() => {
        expect(substituirUrl).toHaveBeenCalledWith(`?tipo_gestao=${TIPO_GESTAO_A.id}`);
      });
    });

    // Achado em dogfooding, depois de corrigir o teste acima: a guarda de
    // loading escondia o resultado sem filtro, mas useDemandas ainda
    // DISPARAVA (e o keepPreviousData guardava) essa 1ª busca. Ao resolver o
    // tipo padrão, o board saía do "Carregando" e reaproveitava esse
    // resultado antigo -- misturado -- até a busca filtrada de verdade
    // responder. Só sumir com o texto de loading não bastava; precisa nunca
    // ter chamado buscarPrimeiraPaginaDaFase sem tipo_gestao enquanto isso está em
    // aberto (ver "desabilitado" em useDemandas.ts/useResumoDemandas.ts).
    it("nunca busca (nem mostra) demandas sem tipo_gestao quando há mais de um tipo cadastrado", async () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      let resolverTipos: (tipos: TipoGestao[]) => void = () => {};
      vi.mocked(listarTiposGestao).mockReturnValue(
        new Promise((resolve) => {
          resolverTipos = resolve;
        }),
      );
      const demandaOperacional = criarDemanda({ titulo: "Card Operacional", status: "backlog" });
      const demandaUnidades = criarDemanda({ titulo: "Card Unidades", status: "backlog" });
      vi.mocked(buscarPrimeiraPaginaDaFase).mockImplementation(async (filtros, status) => {
        if (filtros?.tipo_gestao === TIPO_GESTAO_A.id) return daFase([demandaOperacional], status);
        if (filtros?.tipo_gestao === TIPO_GESTAO_B.id) return daFase([demandaUnidades], status);
        return daFase([demandaOperacional, demandaUnidades], status);
      });

      const { rerender } = renderBoard();

      await waitFor(() => {
        expect(screen.getByText("Carregando demandas...")).toBeInTheDocument();
      });
      expect(buscarPrimeiraPaginaDaFase).not.toHaveBeenCalled();

      resolverTipos([TIPO_GESTAO_A, TIPO_GESTAO_B]);

      await waitFor(() => {
        expect(substituirUrl).toHaveBeenCalledWith(`?tipo_gestao=${TIPO_GESTAO_A.id}`);
      });

      // useSearchParams é mockado (fixo), então não reage sozinho ao
      // router.replace acima como o Next real reagiria -- simula a URL
      // "assentando" e força o re-render que isso causaria em produção.
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams(`tipo_gestao=${TIPO_GESTAO_A.id}`) as never,
      );
      rerender(
        <SWRConfig value={{ provider: () => new Map() }}>
          <KanbanBoard />
        </SWRConfig>,
      );

      await waitFor(() => {
        expect(screen.getByText("Card Operacional")).toBeInTheDocument();
      });
      expect(screen.queryByText("Card Unidades")).not.toBeInTheDocument();
    });
  });
});
