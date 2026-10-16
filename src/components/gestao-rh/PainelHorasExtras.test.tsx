import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnidades } from "@/hooks/useUnidades";
import type { LinhaHorasExtras, PainelHorasExtras as Painel } from "@/types/gestaoRH";
import { PainelHorasExtras } from "./PainelHorasExtras";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/gestao-rh/horas-extras",
  useSearchParams: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn(() => false) }));
vi.mock("recharts", () => import("@/test-utils/rechartsDeTeste"));
vi.mock("@/lib/gestaoRHHorasExtras", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHHorasExtras")>()),
  buscarPainelHorasExtras: vi.fn(),
}));
vi.mock("./DetalheColaboradorModal", () => ({
  DetalheColaboradorModal: ({
    colaboradorId,
    periodoAbsenteismo,
  }: {
    colaboradorId: number | null;
    periodoAbsenteismo?: { inicio: string; fim: string } | null;
  }) => (
    <div data-testid="modal">
      {colaboradorId ?? "fechado"}|{periodoAbsenteismo?.inicio}..{periodoAbsenteismo?.fim}
    </div>
  ),
}));

import { buscarPainelHorasExtras } from "@/lib/gestaoRHHorasExtras";

const NITEROI = { id: 1, nome: "Niterói" };
const MACAE = { id: 2, nome: "Macaé" };
const replace = vi.fn();

function linha(
  id: number,
  nome: string,
  fator1: number,
  fator2: number,
  dias: number,
  unidade: typeof NITEROI = NITEROI,
): LinhaHorasExtras {
  return {
    colaborador: { id, nome, matricula_vr: "", cargo: "Técnico", unidade },
    equipe: `Operações ${unidade.nome}`,
    minutos_por_fator: [
      { fator: "1", minutos: fator1 },
      { fator: "2", minutos: fator2 },
    ],
    total_minutos: fator1 + fator2,
    dias_com_hora_extra: dias,
  };
}

function painel(dados: Partial<Painel> = {}): Painel {
  const linhas = [
    linha(8, "Juliana Ramos", 90, 120, 3),
    linha(9, "Bruno Lima", 150, 0, 2, MACAE),
    linha(10, "Ana Souza", 45, 0, 1),
  ];
  return {
    periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
    com_dado: true,
    parcial: false,
    fatores: [
      { fator: "1", percentual: "50" },
      { fator: "2", percentual: "100" },
    ],
    cards: {
      total_minutos: 405,
      minutos_por_fator: [
        { fator: "1", minutos: 285 },
        { fator: "2", minutos: 120 },
      ],
      colaboradores_com_hora_extra: 3,
    },
    linhas,
    por_unidade: [
      {
        unidade_id: 1,
        nome: "Niterói",
        minutos_por_fator: [
          { fator: "1", minutos: 135 },
          { fator: "2", minutos: 120 },
        ],
        total_minutos: 255,
      },
      {
        unidade_id: 2,
        nome: "Macaé",
        minutos_por_fator: [
          { fator: "1", minutos: 150 },
          { fator: "2", minutos: 0 },
        ],
        total_minutos: 150,
      },
    ],
    ...dados,
  };
}

function renderPainel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <PainelHorasExtras />
    </SWRConfig>,
  );
}

function tabela() {
  return within(screen.getByRole("table"));
}

function nomesNaTabela() {
  return tabela()
    .getAllByRole("row")
    .slice(1)
    // O primeiro botão da linha é o do nome (o segundo, o filtro).
    .map((linhaDaTabela) => within(linhaDaTabela).getAllByRole("button")[0].textContent);
}

// Os gráficos carregam à parte (next/dynamic): com o módulo já carregado, o
// primeiro teste que os espera não depende do tempo de importação.
beforeAll(async () => {
  await import("./GraficosHorasExtras");
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 9, 0));
  vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(useAuth).mockReturnValue({ administraRedePadrao: true } as ReturnType<typeof useAuth>);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [{ id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" }],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(buscarPainelHorasExtras).mockReset();
  vi.mocked(buscarPainelHorasExtras).mockResolvedValue(painel());
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Painel de Horas Extras", () => {
  it("abre no mês anterior fechado, com os cards nos percentuais da rota", async () => {
    renderPainel();

    expect(await screen.findByText("6:45:00")).toBeInTheDocument();
    expect(buscarPainelHorasExtras).toHaveBeenCalledWith({
      inicio: "2026-09-01",
      fim: "2026-09-30",
      unidade: undefined,
    });
    expect(screen.getByText("Horas extras 50%")).toBeInTheDocument();
    expect(screen.getByText("4:45:00")).toBeInTheDocument();
    expect(screen.getByText("Horas extras 100%")).toBeInTheDocument();
    // 285 e 120 dos 405 minutos.
    expect(screen.getByText("70% do total")).toBeInTheDocument();
    expect(screen.getByText("30% do total")).toBeInTheDocument();
    expect(screen.getByText("com hora extra no período")).toBeInTheDocument();
    // O VR também credita essas horas no banco de quem tem banco de horas.
    expect(screen.getByText("no período selecionado").closest("[title]")).toHaveAttribute(
      "title",
      expect.stringContaining("o VR também credita essas horas no saldo"),
    );
    // Turno variável (STC-756): os totais deixam de bater com o VR de propósito.
    expect(screen.getByText("no período selecionado").closest("[title]")).toHaveAttribute(
      "title",
      expect.stringContaining("Nas equipes com turno variável, só o que passou da carga do dia."),
    );
  });

  it("nas pontas, a parte do total não arredonda para 0% nem para 100%", async () => {
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(
      painel({
        cards: {
          total_minutos: 405,
          minutos_por_fator: [
            { fator: "1", minutos: 403 },
            { fator: "2", minutos: 2 },
          ],
          colaboradores_com_hora_extra: 3,
        },
      }),
    );
    renderPainel();

    expect(await screen.findByText("menos de 1% do total")).toBeInTheDocument();
    expect(screen.getByText("mais de 99% do total")).toBeInTheDocument();
  });

  it("gráficos por colaborador e por unidade", async () => {
    renderPainel();

    expect(await screen.findByText("Top 3 colaboradores em horas extras")).toBeInTheDocument();
    expect(screen.getByText("Top 2 unidades em horas extras")).toBeInTheDocument();
  });

  it("com mais de 10 colaboradores, o gráfico mostra o top 10", async () => {
    const linhas = Array.from({ length: 12 }, (_, indice) =>
      linha(100 + indice, `Pessoa ${indice}`, 600 - indice * 10, 0, 1),
    );
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(painel({ linhas }));
    renderPainel();

    expect(await screen.findByText("Top 10 colaboradores em horas extras")).toBeInTheDocument();
  });

  it("unidade filtrada: o gráfico por cargo no lugar do por unidade", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Como a rota: com a unidade filtrada, só ela em `por_unidade`.
    vi.mocked(buscarPainelHorasExtras).mockImplementation(async (filtros) =>
      filtros.unidade ? painel({ por_unidade: painel().por_unidade.slice(0, 1) }) : painel(),
    );
    renderPainel();
    await screen.findByText("Top 2 unidades em horas extras");

    await usuario.click(screen.getByRole("combobox", { name: "Unidade" }));
    await usuario.click(await screen.findByRole("option", { name: "Niterói" }));

    await waitFor(() =>
      expect(buscarPainelHorasExtras).toHaveBeenLastCalledWith(expect.objectContaining({ unidade: 1 })),
    );
    // Os três colaboradores do exemplo têm o mesmo cargo.
    expect(await screen.findByText("Top 1 cargos em horas extras")).toBeInTheDocument();
    expect(screen.queryByText(/unidades em horas extras/)).not.toBeInTheDocument();
    expect(screen.getByText(/colaboradores em horas extras/)).toBeInTheDocument();
  });

  it("tabela com os fatores, o total e os dias, ordenável", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");

    const juliana = tabela().getByRole("button", { name: "Juliana Ramos" }).closest("tr")!;
    expect(within(juliana).getByText("1:30:00")).toBeInTheDocument();
    expect(within(juliana).getByText("2:00:00")).toBeInTheDocument();
    expect(within(juliana).getByText("3:30:00")).toBeInTheDocument();
    expect(tabela().getByText("Macaé")).toBeInTheDocument();
    // Ordem da API: mais horas primeiro.
    expect(nomesNaTabela()).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);

    await usuario.click(tabela().getByRole("button", { name: /^100%/ }));
    expect(nomesNaTabela()).toEqual(["Bruno Lima", "Ana Souza", "Juliana Ramos"]);
    await usuario.click(tabela().getByRole("button", { name: /^Colaborador/ }));
    expect(nomesNaTabela()).toEqual(["Ana Souza", "Bruno Lima", "Juliana Ramos"]);
    expect(screen.getByText("3 colaboradores")).toBeInTheDocument();
  });

  it("tabela numa moldura de 10 linhas, rolando por dentro; no celular, a página rola", async () => {
    const { unmount } = renderPainel();
    await screen.findByRole("table");
    expect(screen.getByTestId("rolagem-horas-extras").style.maxHeight).toBe("623.5px");
    unmount();

    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderPainel();
    await screen.findByRole("table");
    expect(screen.getByTestId("rolagem-horas-extras").style.maxHeight).toBe("");
  });

  it("clicar na barra do colaborador mostra só ele na tabela; clicar de novo, ou em Mostrar todos, volta", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");
    const barra = (nome: string) => screen.getByRole("button", { name: `fator_1:${nome}`, hidden: true });

    await usuario.click(barra("Bruno Lima"));
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);
    expect(screen.getByRole("status")).toHaveTextContent("Mostrando só Bruno Lima");
    // O clique no gráfico não abre o modal; a linha da tabela continua abrindo.
    expect(replace).not.toHaveBeenCalled();

    await usuario.click(barra("Bruno Lima"));
    expect(nomesNaTabela()).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);

    await usuario.click(barra("Ana Souza"));
    await usuario.click(within(screen.getByRole("status")).getByRole("button", { name: "Mostrar todos" }));
    expect(nomesNaTabela()).toHaveLength(3);
  });

  it("filtro da linha, pelo teclado, faz o mesmo que clicar na barra", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");

    const filtro = tabela().getByRole("button", { name: "Mostrar só Bruno Lima" });
    filtro.focus();
    await usuario.keyboard("{Enter}");
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);
    expect(screen.getByRole("status")).toHaveTextContent("Mostrando só Bruno Lima");
    // O mesmo botão, agora ativo, desfaz.
    const ativo = tabela().getByRole("button", { name: "Mostrar todos" });
    expect(ativo).toHaveAttribute("aria-pressed", "true");
    await usuario.click(ativo);
    expect(nomesNaTabela()).toHaveLength(3);
    expect(replace).not.toHaveBeenCalled();
  });

  it("selecionar limpa a busca digitada antes, para a tabela não ficar vazia", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");
    await usuario.type(screen.getByLabelText("Buscar colaborador"), "juliana");
    expect(nomesNaTabela()).toEqual(["Juliana Ramos"]);

    await usuario.click(screen.getByRole("button", { name: "fator_1:Bruno Lima", hidden: true }));

    expect(screen.getByLabelText("Buscar colaborador")).toHaveValue("");
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);
  });

  it("trocar o filtro descarta a seleção, sem ela voltar com o filtro anterior", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");
    await usuario.click(screen.getByRole("button", { name: "fator_1:Bruno Lima", hidden: true }));
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);

    await usuario.click(screen.getByRole("combobox", { name: "Unidade" }));
    await usuario.click(await screen.findByRole("option", { name: "Niterói" }));
    await waitFor(() =>
      expect(buscarPainelHorasExtras).toHaveBeenLastCalledWith(expect.objectContaining({ unidade: 1 })),
    );
    await usuario.click(screen.getByRole("combobox", { name: "Unidade" }));
    await usuario.click(await screen.findByRole("option", { name: "Todas as unidades" }));

    await waitFor(() => expect(nomesNaTabela()).toHaveLength(3));
    expect(screen.queryByText(/Mostrando só/)).not.toBeInTheDocument();
  });

  it("período trocado sem hora extra do selecionado: a seleção some", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(buscarPainelHorasExtras).mockImplementation(async (filtros) =>
      filtros.inicio === "2026-08-01" ? painel({ linhas: painel().linhas.slice(0, 1) }) : painel(),
    );
    renderPainel();
    await screen.findByRole("table");

    await usuario.click(screen.getByRole("button", { name: "fator_1:Bruno Lima", hidden: true }));
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);

    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "2026-08-01" } });
    await waitFor(() => expect(nomesNaTabela()).toEqual(["Juliana Ramos"]));
    expect(screen.queryByText(/Mostrando só/)).not.toBeInTheDocument();
  });

  it("busca filtra a tabela", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");

    await usuario.type(screen.getByLabelText("Buscar colaborador"), "bruno");
    expect(nomesNaTabela()).toEqual(["Bruno Lima"]);
  });

  it("linha abre o modal do colaborador, no período do painel", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByRole("table");

    await usuario.click(tabela().getByRole("button", { name: "Juliana Ramos" }));
    expect(replace).toHaveBeenCalledWith("/modulos/gestao-rh/horas-extras?colaborador=8", {
      scroll: false,
    });
  });

  it("colaborador da URL abre o modal com o período do painel", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("colaborador=8") as never);
    renderPainel();

    expect(await screen.findByTestId("modal")).toHaveTextContent("8|2026-09-01..2026-09-30");
  });

  it("sem hora extra no período: estado vazio próprio, sem gráficos nem tabela", async () => {
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(
      painel({
        linhas: [],
        por_unidade: [],
        cards: {
          total_minutos: 0,
          minutos_por_fator: [
            { fator: "1", minutos: 0 },
            { fator: "2", minutos: 0 },
          ],
          colaboradores_com_hora_extra: 0,
        },
      }),
    );
    renderPainel();

    expect(await screen.findByText("Sem hora extra no período")).toBeInTheDocument();
    expect(screen.getAllByText("0:00:00")).toHaveLength(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/colaboradores em horas extras/)).not.toBeInTheDocument();
  });

  it("período importado antes das horas extras: aviso, e cards com traço em vez de zero", async () => {
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(
      painel({
        com_dado: false,
        fatores: [
          { fator: "1", percentual: null },
          { fator: "2", percentual: null },
        ],
        linhas: [],
        por_unidade: [],
        cards: {
          total_minutos: 0,
          minutos_por_fator: [
            { fator: "1", minutos: 0 },
            { fator: "2", minutos: 0 },
          ],
          colaboradores_com_hora_extra: 0,
        },
      }),
    );
    renderPainel();

    expect(await screen.findByText("Sem dado de hora extra neste período")).toBeInTheDocument();
    expect(screen.getByText(/reimportar este período/)).toBeInTheDocument();
    expect(screen.queryByText("Sem hora extra no período")).not.toBeInTheDocument();
    // Os quatro números e as legendas dos dois fatores.
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.queryByText("0:00:00")).not.toBeInTheDocument();
    // Sem o percentual do VR, o fator aparece pelo número.
    expect(screen.getByText("Horas extras Fator 1")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("período parcial: aviso de que os totais não contam parte dos dias", async () => {
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(painel({ parcial: true }));
    renderPainel();

    expect(await screen.findByRole("status")).toHaveTextContent(/Período parcial/);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("filtro de unidade só com as unidades da rede própria (sem as de Operações Especiais)", async () => {
    renderPainel();
    await screen.findByText("Juliana Ramos");
    expect(useUnidades).toHaveBeenCalledWith("padrao");
    expect(useUnidades).not.toHaveBeenCalledWith();
  });

  it("coordenação: sem o filtro de unidade, e com o gráfico por cargo", async () => {
    vi.mocked(useAuth).mockReturnValue({ administraRedePadrao: false } as ReturnType<typeof useAuth>);
    // A rota devolve só a unidade da coordenação.
    vi.mocked(buscarPainelHorasExtras).mockResolvedValue(
      painel({ por_unidade: painel().por_unidade.slice(0, 1) }),
    );
    renderPainel();
    await screen.findByRole("table");

    expect(screen.queryByRole("combobox", { name: "Unidade" })).not.toBeInTheDocument();
    expect(await screen.findByText("Top 1 cargos em horas extras")).toBeInTheDocument();
    expect(screen.queryByText(/unidades em horas extras/)).not.toBeInTheDocument();
  });

  it("erro na primeira busca: mensagem e tentar de novo", async () => {
    vi.mocked(buscarPainelHorasExtras).mockRejectedValue(new Error("falhou"));
    renderPainel();

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
