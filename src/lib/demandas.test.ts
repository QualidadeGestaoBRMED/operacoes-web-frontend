import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import { listarDemandas } from "./demandas";

vi.mock("./api", () => ({
  default: { get: vi.fn() },
}));

const apiGetMock = vi.mocked(api.get);

function paginaMock(indices: number[], count: number, next: string | null) {
  return {
    data: {
      count,
      next,
      previous: null,
      results: indices.map((i) => ({ id: i })),
    },
  };
}

describe("listarDemandas", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("devolve os resultados de uma única página quando next é null, sem chamada extra", async () => {
    apiGetMock.mockResolvedValueOnce(paginaMock([1], 1, null));

    const resultado = await listarDemandas();

    expect(resultado).toEqual([{ id: 1 }]);
    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });

  it("calcula o total de páginas pelo count da 1ª página e busca o restante em paralelo", async () => {
    // 45 itens, página com 20 -- 1ª página + 2 páginas em paralelo (2 e 3).
    apiGetMock.mockImplementation(async (_url, config) => {
      const pagina = (config as { params?: { page?: number } })?.params?.page ?? 1;
      if (pagina === 1) {
        return paginaMock(
          Array.from({ length: 20 }, (_, i) => i + 1),
          45,
          "https://operacoes-web-backend.onrender.com/api/modulos/gestao-demandas/demandas/?page=2",
        );
      }
      if (pagina === 2) {
        return paginaMock(
          Array.from({ length: 20 }, (_, i) => i + 21),
          45,
          "irrelevante-nao-e-mais-lido",
        );
      }
      return paginaMock([41, 42, 43, 44, 45], 45, null);
    });

    const resultado = await listarDemandas();

    expect(resultado).toHaveLength(45);
    expect(resultado.map((d) => d.id)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(apiGetMock).toHaveBeenCalledTimes(3);
    // nunca a URL absoluta de "next" -- sempre o mesmo BASE_URL relativo,
    // que passa pelo proxy /api/backend com o token.
    for (const [urlChamada] of apiGetMock.mock.calls) {
      expect(urlChamada).toBe("/modulos/gestao-demandas/demandas/");
    }
  });

  it("preserva os filtros em todas as páginas buscadas em paralelo", async () => {
    apiGetMock.mockImplementation(async (_url, config) => {
      const pagina = (config as { params?: { page?: number } })?.params?.page ?? 1;
      return paginaMock(
        pagina === 1 ? Array.from({ length: 20 }, (_, i) => i + 1) : [21],
        21,
        pagina === 1 ? "https://x/demandas/?page=2" : null,
      );
    });

    await listarDemandas({ search: "zebra" });

    for (const [, config] of apiGetMock.mock.calls) {
      expect((config as { params?: Record<string, unknown> })?.params).toMatchObject({
        search: "zebra",
      });
    }
  });

  it("descarta duplicata quando uma demanda criada entre as buscas repete um id em duas páginas", async () => {
    // Drift real de paginação por offset: uma criação entre a busca da
    // página 1 e da página 2 desloca as demais, e o id que fechava a
    // página 1 pode reaparecer abrindo a página 2.
    apiGetMock.mockImplementation(async (_url, config) => {
      const pagina = (config as { params?: { page?: number } })?.params?.page ?? 1;
      if (pagina === 1) {
        return paginaMock([1, 2, 3], 5, "https://x/demandas/?page=2");
      }
      return paginaMock([3, 4, 5], 5, null); // 3 repetido de propósito
    });

    const resultado = await listarDemandas();

    expect(resultado.map((d) => d.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("limita o número de páginas buscadas em paralelo mesmo com count absurdo", async () => {
    apiGetMock.mockImplementation(async (_url, config) => {
      const pagina = (config as { params?: { page?: number } })?.params?.page ?? 1;
      return paginaMock(
        [pagina],
        20 * 100_000, // count malformado -- não deve virar 100.000 requisições
        pagina === 1 ? "https://x/demandas/?page=2" : "https://x/demandas/?page=999999",
      );
    });

    await listarDemandas();

    expect(apiGetMock.mock.calls.length).toBeLessThan(600);
  });
});
