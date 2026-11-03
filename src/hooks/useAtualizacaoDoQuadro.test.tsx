import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/lib/api";
import { FASES_DO_QUADRO } from "@/lib/demandas";
import type { DemandaFiltros } from "@/types";
import { ehChaveDeListaDemandas } from "./useDemandaMutations";
import { useAtualizacaoDoQuadro, useDemandasDaFase } from "./useDemandas";

// O quadro inteiro com a busca de verdade (lib/demandas) e o cliente HTTP
// simulado: conta as requisições que a abertura e a atualização fazem.
vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(api.get);

const pagina = (id: number) => ({ count: 1, next: null, previous: null, results: [{ id, updated_at: "t" }] });

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function quadro(filtros: DemandaFiltros, opcoes: { pausado?: boolean } = {}) {
  return renderHook(
    () => {
      useAtualizacaoDoQuadro(filtros, opcoes);
      const colunas = [...FASES_DO_QUADRO, "lixeira" as const].map((fase) =>
        useDemandasDaFase(filtros, fase, opcoes),
      );
      return { colunas, mutate: useSWRConfig().mutate };
    },
    { wrapper },
  );
}

/** Espera a condição com setTimeout: o relógio do quadro é um setInterval
 * simulado, e o waitFor da testing-library também usa setInterval. */
async function ate(condicao: () => boolean) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (condicao()) return;
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 10));
    });
  }
  expect(condicao()).toBe(true);
}

const pedidosAoQuadro = () => get.mock.calls.filter(([url]) => String(url).endsWith("por-fase/")).length;
const pedidosALixeira = () =>
  get.mock.calls.filter(([, config]) => (config as { params?: { status?: string } })?.params?.status === "lixeira").length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  get.mockReset().mockImplementation(async (url: string) => ({
    data: url.endsWith("por-fase/")
      ? Object.fromEntries(FASES_DO_QUADRO.map((fase, indice) => [fase, pagina(indice + 1)]))
      : pagina(99),
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("colunas do quadro numa requisição só (STC-969)", () => {
  it("abrir o quadro faz uma requisição para as quatro colunas, e a Lixeira a dela", async () => {
    const { result } = quadro({ tipo_gestao: 2 });

    await ate(() => result.current.colunas.every((c) => c.total === 1));
    expect(pedidosAoQuadro()).toBe(1);
    expect(pedidosALixeira()).toBe(1);
    expect(result.current.colunas.map((c) => c.demandas[0].id)).toEqual([1, 2, 3, 4, 99]);
  });

  it("a cada 30 segundos, uma requisição para as quatro colunas", async () => {
    const { result } = quadro({ tipo_gestao: 2 });
    await ate(() => result.current.colunas[0].total === 1);

    await act(async () => vi.advanceTimersByTime(30_000));

    await ate(() => pedidosAoQuadro() === 2);
    await act(async () => vi.advanceTimersByTime(30_000));
    await ate(() => pedidosAoQuadro() === 3);
  });

  it("pausado (card sendo arrastado), a atualização não busca", async () => {
    const { result } = quadro({ tipo_gestao: 2 }, { pausado: true });
    await ate(() => result.current.colunas[0].total === 1);

    await act(async () => vi.advanceTimersByTime(60_000));

    expect(pedidosAoQuadro()).toBe(1);
  });

  it("com a aba em segundo plano, a atualização não busca", async () => {
    const { result } = quadro({ tipo_gestao: 2 });
    await ate(() => result.current.colunas[0].total === 1);
    const visibilidade = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    await act(async () => vi.advanceTimersByTime(60_000));

    expect(pedidosAoQuadro()).toBe(1);
    visibilidade.mockRestore();
  });

  it("uma ação na lista (mover, editar, comentar) atualiza as quatro numa requisição", async () => {
    const { result } = quadro({ tipo_gestao: 2 });
    await ate(() => result.current.colunas[0].total === 1);

    await act(async () => {
      await result.current.mutate(ehChaveDeListaDemandas);
    });

    expect(pedidosAoQuadro()).toBe(2);
  });
});
