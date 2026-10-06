import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useUnidades } from "@/hooks/useUnidades";
import { painelAbsenteismoDeExemplo } from "@/lib/gestaoRHAbsenteismoExemplo";
import type { PainelAbsenteismo as Painel } from "@/types/gestaoRH";
import { PainelAbsenteismo } from "./PainelAbsenteismo";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/gestao-rh",
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
vi.mock("@/lib/gestaoRHAbsenteismo", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHAbsenteismo")>()),
  buscarPainelAbsenteismo: vi.fn(),
}));
vi.mock("./DetalheColaboradorModal", () => ({
  DetalheColaboradorModal: ({ colaboradorId }: { colaboradorId: number | null }) => (
    <div data-testid="modal">{colaboradorId ?? "fechado"}</div>
  ),
}));

import { buscarPainelAbsenteismo } from "@/lib/gestaoRHAbsenteismo";

const replace = vi.fn();
// Os mesmos dados de exemplo do ambiente local, que seguem o contrato da STC-588.
const PAINEL: Painel = painelAbsenteismoDeExemplo({ inicio: "2026-09-01", fim: "2026-09-30" });

function renderPainel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <PainelAbsenteismo />
    </SWRConfig>,
  );
}

function usuario() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function ultimaBusca() {
  return vi.mocked(buscarPainelAbsenteismo).mock.lastCall?.[0];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(useAuth).mockReturnValue({ isAdminOps: true } as ReturnType<typeof useAuth>);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [{ id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" }],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(buscarPainelAbsenteismo).mockReset();
  vi.mocked(buscarPainelAbsenteismo).mockResolvedValue(PAINEL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Painel de Absenteísmo", () => {
  it("abre no mês anterior fechado, com cards, meta e data dos dados", async () => {
    renderPainel();

    expect(await screen.findByText("Juliana Ramos")).toBeInTheDocument();
    expect(vi.mocked(buscarPainelAbsenteismo).mock.calls[0][0]).toEqual({
      inicio: "2026-09-01",
      fim: "2026-09-30",
      unidade: undefined,
      faixa: undefined,
      ocorrencia: undefined,
      com_pendencias: undefined,
    });
    expect(screen.getByText("meta: até 5%")).toBeInTheDocument();
    expect(screen.getByText(/dados até 30\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Faixa crítica")).toBeInTheDocument();
    expect(screen.getByText("8 colaboradores")).toBeInTheDocument();
  });

  it("linha: percentual com faixa, provisório, ocorrências e banco de horas", async () => {
    renderPainel();

    const juliana = within((await screen.findByText("Juliana Ramos")).closest("tr") as HTMLElement);
    expect(juliana.getByText("13,6%")).toBeInTheDocument();
    expect(juliana.getByText("Crítica")).toBeInTheDocument();
    expect(juliana.getByText("provisório · 2 pendências")).toBeInTheDocument();
    expect(juliana.getByText("15 de 21")).toBeInTheDocument();
    expect(juliana.getByText("2 faltas · 1 atestado")).toBeInTheDocument();
    expect(juliana.getByText(/1 atraso · 1 saída antecipada/)).toBeInTheDocument();
    expect(juliana.getByText("-03:40")).toBeInTheDocument();

    const marcos = within(screen.getByText("Marcos Lima").closest("tr") as HTMLElement);
    // Sem dia previsto no período: traço em dias, percentual e conformidade.
    expect(marcos.getAllByText("—")).toHaveLength(3);
    expect(marcos.getByText("Nenhuma")).toBeInTheDocument();
  });

  it("com faixas cadastradas, abre filtrando crítica e atenção; \"Todas\" mostra todos", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["critica", "atencao"]));
    expect(screen.getByLabelText("Faixa")).toHaveTextContent("Crítica e atenção");

    await user.click(screen.getByLabelText("Faixa"));
    await user.click(await screen.findByRole("option", { name: "Todas as faixas" }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toBeUndefined());
    // A escolha da pessoa vale: o filtro padrão não volta.
    await user.click(screen.getByRole("checkbox", { name: "Com pendências" }));
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));
    expect(ultimaBusca()?.faixa).toBeUndefined();
  });

  it("sem faixas cadastradas: sem cards, filtro e selo de faixa; sem meta, avisa", async () => {
    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue({
      ...PAINEL,
      parametros: { meta_percentual: null, faixas_cadastradas: false, limite_atraso_minutos: 15 },
      linhas: PAINEL.linhas.map((linha) => ({ ...linha, faixa: null })),
    });
    renderPainel();
    await screen.findByText("Juliana Ramos");

    expect(screen.queryByText("Faixa crítica")).not.toBeInTheDocument();
    expect(screen.queryByText("Faixa de atenção")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Faixa")).not.toBeInTheDocument();
    expect(screen.queryByText("Crítica")).not.toBeInTheDocument();
    expect(screen.getByText("sem meta cadastrada")).toBeInTheDocument();
    expect(ultimaBusca()?.faixa).toBeUndefined();
  });

  it("filtros vão para a API no formato do contrato", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.click(screen.getByLabelText("Faixa"));
    await user.click(await screen.findByRole("option", { name: "Só atenção" }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["atencao"]));

    await user.click(screen.getByLabelText("Ocorrência"));
    await user.click(await screen.findByRole("option", { name: "Atraso" }));
    await waitFor(() => expect(ultimaBusca()?.ocorrencia).toEqual(["atraso"]));

    await user.click(screen.getByRole("checkbox", { name: "Com pendências" }));
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));

    await user.click(screen.getByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await waitFor(() => expect(ultimaBusca()?.unidade).toBe(1));
  });

  it("faixa escolhida deixa de valer se as faixas deixarem de existir", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");
    await user.click(screen.getByLabelText("Faixa"));
    await user.click(await screen.findByRole("option", { name: "Só crítica" }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["critica"]));

    // Um Admin apagou as faixas nos Parâmetros; a próxima busca já vem sem elas.
    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue({
      ...PAINEL,
      parametros: { ...PAINEL.parametros, faixas_cadastradas: false },
    });
    await user.click(screen.getByRole("checkbox", { name: "Com pendências" }));

    await waitFor(() => expect(screen.queryByLabelText("Faixa")).not.toBeInTheDocument());
    await waitFor(() => expect(ultimaBusca()?.faixa).toBeUndefined());
  });

  it("filtro de unidade só para Admin", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminOps: false } as ReturnType<typeof useAuth>);
    renderPainel();
    await screen.findByText("Juliana Ramos");

    expect(screen.queryByLabelText("Unidade")).not.toBeInTheDocument();
  });

  it("período com o fim antes do início não busca e avisa", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");
    const chamadas = vi.mocked(buscarPainelAbsenteismo).mock.calls.length;

    await user.clear(screen.getByLabelText("até"));
    await user.type(screen.getByLabelText("até"), "2026-08-15");

    expect(screen.getByText("Informe início e fim, com o fim depois do início.")).toBeInTheDocument();
    expect(vi.mocked(buscarPainelAbsenteismo).mock.calls.length).toBe(chamadas);
    expect(screen.getByText("Juliana Ramos")).toBeInTheDocument();
  });

  it("busca por nome sem acento e ordenação pelo cabeçalho", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.type(screen.getByLabelText("Buscar colaborador"), "leonardo araujo");
    expect(screen.getByText("1 colaborador")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Buscar colaborador"));

    await user.click(screen.getByRole("button", { name: "Banco h." }));
    const primeira = screen.getAllByRole("row")[1];
    expect(within(primeira).getByText("Juliana Ramos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Banco h." }));
    expect(within(screen.getAllByRole("row")[1]).getByText("Rafael Souza")).toBeInTheDocument();
  });

  it("clicar no colaborador abre o modal pela URL", async () => {
    const user = usuario();
    renderPainel();

    await user.click(await screen.findByRole("button", { name: "Juliana Ramos" }));

    expect(replace).toHaveBeenCalledWith("/modulos/gestao-rh?colaborador=8", { scroll: false });
  });

  it("erro sem dados ocupa a tela e oferece tentar de novo", async () => {
    vi.mocked(buscarPainelAbsenteismo).mockRejectedValue(new Error("Falha de rede"));
    renderPainel();

    expect(
      await screen.findByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
