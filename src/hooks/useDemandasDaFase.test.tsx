import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listarDemandasDaFase } from "@/lib/demandas";
import type { Demanda, DemandaFiltros } from "@/types";
import { useDemandasDaFase } from "./useDemandas";

vi.mock("@/lib/demandas", async (original) => ({
  ...(await original<typeof import("@/lib/demandas")>()),
  listarDemandasDaFase: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

// A fase tem 70 cards: 30 por página, a última com 10.
function fase(paginas: number) {
  const carregados = Math.min(paginas * 30, 70);
  return {
    demandas: Array.from({ length: carregados }, (_, i) => ({ id: i + 1 }) as Demanda),
    total: 70,
    paginas: Math.min(paginas, 3),
    temMais: paginas < 3,
  };
}

beforeEach(() => {
  vi.mocked(listarDemandasDaFase).mockReset().mockImplementation(async (_f, _s, paginas) => fase(paginas));
});

describe("useDemandasDaFase (STC-931)", () => {
  it("começa pela primeira página e traz o total da fase", async () => {
    const { result } = renderHook(() => useDemandasDaFase({ tipo_gestao: 2 }, "concluido"), { wrapper });

    await waitFor(() => expect(result.current.demandas).toHaveLength(30));
    expect(result.current.total).toBe(70);
    expect(result.current.temMais).toBe(true);
    expect(listarDemandasDaFase).toHaveBeenLastCalledWith({ tipo_gestao: 2 }, "concluido", 1);
  });

  it("carregarMais pede a página seguinte sem apagar as já carregadas", async () => {
    const { result } = renderHook(() => useDemandasDaFase({}, "concluido"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(30));

    act(() => result.current.carregarMais());

    expect(result.current.demandas).toHaveLength(30);
    expect(result.current.carregandoMais).toBe(true);
    await waitFor(() => expect(result.current.demandas).toHaveLength(60));
    expect(listarDemandasDaFase).toHaveBeenLastCalledWith({}, "concluido", 2);
    expect(result.current.carregandoMais).toBe(false);
  });

  it("não pede mais quando a fase acabou", async () => {
    vi.mocked(listarDemandasDaFase).mockResolvedValue({
      demandas: [{ id: 1 } as Demanda],
      total: 1,
      paginas: 1,
      temMais: false,
    });
    const { result } = renderHook(() => useDemandasDaFase({}, "backlog"), { wrapper });
    await waitFor(() => expect(result.current.demandas).toHaveLength(1));

    act(() => result.current.carregarMais());

    expect(listarDemandasDaFase).toHaveBeenCalledTimes(1);
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
      expect(listarDemandasDaFase).toHaveBeenLastCalledWith({ tipo_gestao: 2 }, "concluido", 1),
    );
  });
});
