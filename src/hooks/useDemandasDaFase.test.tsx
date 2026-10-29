import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buscarPrimeiraPaginaDaFase, listarPaginasExtrasDaFase } from "@/lib/demandas";
import type { Demanda, DemandaFiltros } from "@/types";
import { useDemandasDaFase } from "./useDemandas";

vi.mock("@/lib/demandas", async (original) => ({
  ...(await original<typeof import("@/lib/demandas")>()),
  buscarPrimeiraPaginaDaFase: vi.fn(),
  listarPaginasExtrasDaFase: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

const cards = (de: number, ate: number) =>
  Array.from({ length: ate - de + 1 }, (_, i) => ({ id: de + i, updated_at: "t" }) as Demanda);

// A fase tem 70 cards: 30 na primeira página, 30 na segunda e 10 na terceira.
function primeiraPagina(total = 70) {
  return { count: total, next: "https://x/?page=2", previous: null, results: cards(1, 30) };
}

beforeEach(() => {
  vi.mocked(buscarPrimeiraPaginaDaFase).mockReset().mockResolvedValue(primeiraPagina());
  vi.mocked(listarPaginasExtrasDaFase)
    .mockReset()
    .mockImplementation(async (_f, _s, ate) => ({
      demandas: cards(31, Math.min(ate * 30, 70)),
      ate,
      temMais: ate < 3,
    }));
});

describe("useDemandasDaFase (STC-931)", () => {
  it("começa pela primeira página e traz o total da fase", async () => {
    const { result } = renderHook(() => useDemandasDaFase({ tipo_gestao: 2 }, "concluido"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
    expect(result.current.total).toBe(70);
    expect(result.current.temMais).toBe(true);
    expect(buscarPrimeiraPaginaDaFase).toHaveBeenCalledWith({ tipo_gestao: 2 }, "concluido");
    expect(listarPaginasExtrasDaFase).not.toHaveBeenCalled();
  });

  it("carregarMais busca a página seguinte sem apagar as já carregadas", async () => {
    const { result } = renderHook(() => useDemandasDaFase({}, "concluido"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));

    act(() => result.current.carregarMais());

    expect(result.current.demandas).toHaveLength(30);
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));
    expect(listarPaginasExtrasDaFase).toHaveBeenLastCalledWith({}, "concluido", 2);
    expect(result.current.carregandoMais).toBe(false);
  });

  it("buscar a primeira página de novo não refaz as extras se a fase não mudou", async () => {
    const { result } = renderHook(() => useDemandasDaFase({}, "concluido"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));

    await act(async () => result.current.revalidar());

    await waitFor(() => expect(buscarPrimeiraPaginaDaFase).toHaveBeenCalledTimes(2));
    expect(listarPaginasExtrasDaFase).toHaveBeenCalledTimes(1);
  });

  it("quando a fase muda (outro total), as extras são buscadas de novo", async () => {
    const { result } = renderHook(() => useDemandasDaFase({}, "concluido"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));

    vi.mocked(buscarPrimeiraPaginaDaFase).mockResolvedValue(primeiraPagina(71));
    await act(async () => result.current.revalidar());

    await waitFor(() => expect(listarPaginasExtrasDaFase).toHaveBeenCalledTimes(2));
  });

  it("falha nas extras fica na coluna e os cards já carregados continuam", async () => {
    vi.mocked(listarPaginasExtrasDaFase).mockRejectedValueOnce(new Error("timeout"));
    const { result } = renderHook(() => useDemandasDaFase({}, "concluido"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));

    act(() => result.current.carregarMais());

    await waitFor(() => expect(result.current.erroAoCarregarMais).not.toBeNull());
    expect(result.current.demandas).toHaveLength(30);
    expect(result.current.error).toBeUndefined();

    await act(async () => result.current.tentarDeNovo());
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));
  });

  it("não pede mais quando a fase acabou", async () => {
    vi.mocked(buscarPrimeiraPaginaDaFase).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: cards(1, 1),
    });
    const { result } = renderHook(() => useDemandasDaFase({}, "backlog"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(1));

    act(() => result.current.carregarMais());

    expect(listarPaginasExtrasDaFase).not.toHaveBeenCalled();
  });

  it("trocar os filtros volta para a primeira página", async () => {
    const { result, rerender } = renderHook(
      ({ filtros }: { filtros: DemandaFiltros }) => useDemandasDaFase(filtros, "concluido"),
      { wrapper, initialProps: { filtros: { tipo_gestao: 1 } } },
    );
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));

    rerender({ filtros: { tipo_gestao: 2 } });

    await waitFor(() =>
      expect(buscarPrimeiraPaginaDaFase).toHaveBeenLastCalledWith({ tipo_gestao: 2 }, "concluido"),
    );
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
  });
});
