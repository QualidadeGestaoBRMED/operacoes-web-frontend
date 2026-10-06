import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useUnidades } from "@/hooks/useUnidades";
import type { LinhaPainelFerias, PainelFerias as Painel } from "@/types/gestaoRH";
import { PainelFerias } from "./PainelFerias";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/gestao-rh/ferias",
  useSearchParams: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/useAlturaSemLinhaCortada", () => ({
  useAlturaSemLinhaCortada: () => ({
    refPai: { current: null },
    refTabela: { current: null },
    maxHeight: undefined,
  }),
}));
vi.mock("@/lib/gestaoRHFerias", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHFerias")>()),
  buscarPainelFerias: vi.fn(),
}));
// O modal tem os próprios testes (AbaFerias.test.tsx); aqui só importa o que ele recebe.
vi.mock("./DetalheColaboradorModal", () => ({
  DetalheColaboradorModal: ({
    colaboradorId,
    periodoEmFoco,
  }: {
    colaboradorId: number | null;
    periodoEmFoco: number | null;
  }) => (
    <div data-testid="modal">
      {colaboradorId ?? "fechado"}/{periodoEmFoco ?? "-"}
    </div>
  ),
}));

import { buscarPainelFerias } from "@/lib/gestaoRHFerias";

function linha(
  id: number,
  nome: string,
  extra: Partial<LinhaPainelFerias> = {},
): LinhaPainelFerias {
  return {
    colaborador: {
      id,
      nome,
      matricula_vr: String(1000 + id),
      cargo: "Técnico de Enfermagem",
      unidade: { id: 1, nome: "Macaé" },
    },
    periodo: {
      id: id * 10,
      inicio_aquisitivo: "2024-10-11",
      fim_aquisitivo: "2025-10-10",
      limite_concessivo: "2026-10-10",
      status: "pendente",
    },
    outros_periodos_pendentes: 0,
    proximo_marco: { tipo: "limite", rotulo: "Limite para tirar", data: "2026-10-10" },
    limite_vencido_ha_dias: null,
    programacao: null,
    demandas_abertas: 1,
    ...extra,
  };
}

const PAINEL: Painel = {
  linhas: [
    linha(1, "Marcos Lima", {
      periodo: {
        id: 1,
        inicio_aquisitivo: "2024-08-20",
        fim_aquisitivo: "2025-08-19",
        limite_concessivo: "2026-08-19",
        status: "limite_vencido",
      },
      outros_periodos_pendentes: 1,
      proximo_marco: null,
      limite_vencido_ha_dias: 48,
      demandas_abertas: 2,
    }),
    linha(2, "Eduardo Pires"),
    linha(3, "Leonardo Araújo", {
      periodo: {
        id: 30,
        inicio_aquisitivo: "2024-12-28",
        fim_aquisitivo: "2025-12-27",
        limite_concessivo: "2026-12-27",
        status: "programado",
      },
      proximo_marco: { tipo: "acionar_rh", rotulo: "Acionar o RH até", data: "2026-10-14" },
      programacao: {
        id: 5,
        data_inicio: "2026-11-23",
        data_fim: "2026-12-22",
        dias: 30,
        necessita_substituicao: true,
        data_limite_substituicao: "2026-10-14",
        rh_acionado_em: null,
        rh_acionado_por: null,
      },
      demandas_abertas: 1,
    }),
  ],
  cards: {
    limite_vencido: 1,
    perto_do_limite: 1,
    dias_perto_do_limite: 80,
    sem_programacao: 4,
    substituicao_a_acionar: 1,
    programacao_adiada: 0,
    alertas_na_janela: 13,
    demandas_na_janela: 9,
    ultima_importacao: null,
  },
};

const replace = vi.fn();

function renderPainel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PainelFerias />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(useAuth).mockReturnValue({ isAdminOps: true } as ReturnType<typeof useAuth>);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [{ id: 1, nome: "Macaé", codigo: "MAC", cidade: "Macaé", ativa: true, rede: "padrao" }],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(buscarPainelFerias).mockReset();
  vi.mocked(buscarPainelFerias).mockResolvedValue(PAINEL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Painel de Férias", () => {
  it("abre na janela de 90 dias, com cards, contagem da janela e as linhas", async () => {
    renderPainel();

    expect(await screen.findByText("Marcos Lima")).toBeInTheDocument();
    expect(buscarPainelFerias).toHaveBeenCalledWith({
      janela_dias: 90,
      unidade: undefined,
      status: undefined,
    });
    expect(
      screen.getByText(/13 alertas e 9 demandas geradas nos últimos 90 dias · Nenhuma importação ainda/),
    ).toBeInTheDocument();
    expect(screen.getByText("limite em menos de 80 dias")).toBeInTheDocument();
    expect(screen.getByText(/Os cards contam períodos de férias em qualquer data/)).toBeInTheDocument();
    expect(screen.getByText("3 colaboradores")).toBeInTheDocument();
  });

  it("mostra o próximo marco sempre à frente, o limite vencido e o período a mais", async () => {
    renderPainel();

    const marcos = within((await screen.findByText("Marcos Lima")).closest("tr") as HTMLElement);
    expect(marcos.getByText("Nenhum")).toBeInTheDocument();
    expect(marcos.getByText("limite vencido há 48 dias")).toBeInTheDocument();
    expect(marcos.getByText("+1 período pendente")).toBeInTheDocument();
    expect(marcos.getByText("2 demandas abertas")).toBeInTheDocument();

    const eduardo = within(screen.getByText("Eduardo Pires").closest("tr") as HTMLElement);
    expect(eduardo.getByText("Limite em 4 dias")).toBeInTheDocument();
    expect(eduardo.getByText("Demanda aberta")).toBeInTheDocument();

    const leonardo = within(screen.getByText("Leonardo Araújo").closest("tr") as HTMLElement);
    expect(leonardo.getByText("Acionar o RH até")).toBeInTheDocument();
    expect(leonardo.getByText("14/10/2026")).toBeInTheDocument();
    expect(leonardo.getByText("Férias 23/11 a 22/12 · com substituição")).toBeInTheDocument();
  });

  it("trocar a janela busca de novo", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByText("Marcos Lima");

    await user.click(screen.getByLabelText("Marcos nos próximos"));
    await user.click(await screen.findByRole("option", { name: "30 dias" }));

    await waitFor(() =>
      expect(buscarPainelFerias).toHaveBeenLastCalledWith(expect.objectContaining({ janela_dias: 30 })),
    );
  });

  it("troca de janela esmaece a tabela até a resposta chegar", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByText("Marcos Lima");
    let responder: (painel: Painel) => void = () => {};
    vi.mocked(buscarPainelFerias).mockImplementationOnce(
      () => new Promise((resolve) => (responder = resolve)),
    );

    await user.click(screen.getByLabelText("Marcos nos próximos"));
    await user.click(await screen.findByRole("option", { name: "30 dias" }));

    const moldura = () => screen.getByRole("table").closest("[aria-busy]");
    await waitFor(() => expect(moldura()).toHaveAttribute("aria-busy", "true"));
    responder(PAINEL);
    await waitFor(() => expect(moldura()).toBeNull());
  });

  it("busca por nome sem acento ou por matrícula", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByText("Marcos Lima");

    await user.type(screen.getByLabelText("Buscar colaborador"), "leonardo araujo");
    expect(screen.getByText("Leonardo Araújo")).toBeInTheDocument();
    expect(screen.queryByText("Marcos Lima")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar colaborador"));
    await user.type(screen.getByLabelText("Buscar colaborador"), "1002");
    expect(screen.getByText("Eduardo Pires")).toBeInTheDocument();
    expect(screen.getByText("1 colaborador")).toBeInTheDocument();
  });

  it("cabeçalho ordena crescente, decrescente e volta à ordem da API", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByText("Marcos Lima");
    const nomes = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((linhaTabela) => within(linhaTabela).getAllByRole("button")[0].textContent);

    expect(nomes()).toEqual(["Marcos Lima", "Eduardo Pires", "Leonardo Araújo"]);

    await user.click(screen.getByRole("button", { name: "Colaborador" }));
    expect(nomes()).toEqual(["Eduardo Pires", "Leonardo Araújo", "Marcos Lima"]);
    expect(screen.getByRole("columnheader", { name: "Colaborador" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    await user.click(screen.getByRole("button", { name: "Colaborador" }));
    expect(nomes()).toEqual(["Marcos Lima", "Leonardo Araújo", "Eduardo Pires"]);

    await user.click(screen.getByRole("button", { name: "Colaborador" }));
    expect(nomes()).toEqual(["Marcos Lima", "Eduardo Pires", "Leonardo Araújo"]);
  });

  it("próximo marco: na ordem decrescente, o limite vencido vai para o fim", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();
    await screen.findByText("Marcos Lima");

    await user.click(screen.getByRole("button", { name: "Próximo marco" }));
    await user.click(screen.getByRole("button", { name: "Próximo marco" }));

    const linhas = screen.getAllByRole("row").slice(1);
    expect(within(linhas[0]).getByText("Leonardo Araújo")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("Eduardo Pires")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("Marcos Lima")).toBeInTheDocument();
  });

  it("filtro de unidade só para Admin (a coordenação já recebe só a própria unidade)", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminOps: false } as ReturnType<typeof useAuth>);
    renderPainel();
    await screen.findByText("Marcos Lima");

    expect(screen.queryByLabelText("Unidade")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("clicar no colaborador abre o modal pela URL, sem período em foco", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPainel();

    await user.click(await screen.findByRole("button", { name: "Eduardo Pires" }));

    expect(replace).toHaveBeenCalledWith("/modulos/gestao-rh/ferias?colaborador=2", {
      scroll: false,
    });
  });

  it("card do Kanban: colaborador e período da URL chegam ao modal", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("colaborador=1&periodo=2") as never,
    );
    renderPainel();

    expect(screen.getByTestId("modal")).toHaveTextContent("1/2");
  });

  it("falha numa revalidação mantém a tabela e oferece tentar de novo", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <PainelFerias />
      </SWRConfig>,
    );
    await screen.findByText("Marcos Lima");

    vi.mocked(buscarPainelFerias).mockRejectedValueOnce(new Error("Falha de rede"));
    await user.click(screen.getByLabelText("Marcos nos próximos"));
    await user.click(await screen.findByRole("option", { name: "30 dias" }));

    expect(await screen.findByText(/Não foi possível atualizar o painel/)).toBeInTheDocument();
    expect(screen.getByText("Marcos Lima")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() =>
      expect(screen.queryByText(/Não foi possível atualizar o painel/)).not.toBeInTheDocument(),
    );
  });

  it("sem ninguém na janela, mostra o vazio; erro da API aparece no lugar da tabela", async () => {
    vi.mocked(buscarPainelFerias).mockResolvedValueOnce({ ...PAINEL, linhas: [] });
    const { unmount } = renderPainel();
    expect(
      await screen.findByText("Nenhum colaborador com marco de férias na janela escolhida"),
    ).toBeInTheDocument();
    unmount();

    vi.mocked(buscarPainelFerias).mockRejectedValue(new Error("Falha de rede"));
    renderPainel();
    expect(
      await screen.findByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
