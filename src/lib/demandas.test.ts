import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import { listarDemandas } from "./demandas";

vi.mock("./api", () => ({
  default: { get: vi.fn() },
}));

const apiGetMock = vi.mocked(api.get);

describe("listarDemandas", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("devolve os resultados de uma única página quando next é null", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [{ id: 1 }] },
    });

    const resultado = await listarDemandas();

    expect(resultado).toEqual([{ id: 1 }]);
    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });

  it("segue as páginas seguintes pelo cliente api de sempre, nunca chamando o next literalmente", async () => {
    // STC-407: next vem como URL absoluta apontando direto pro Django (via
    // NEXT_PUBLIC_API_URL) -- chamar literal ignoraria o baseURL do axios
    // (/api/backend) e mandaria a requisição sem token, direto do
    // navegador. Confirma que só o número da página é reaproveitado.
    apiGetMock
      .mockResolvedValueOnce({
        data: {
          count: 22,
          next: "https://operacoes-web-backend.onrender.com/api/modulos/gestao-demandas/demandas/?page=2",
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })),
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 22,
          next: null,
          previous:
            "https://operacoes-web-backend.onrender.com/api/modulos/gestao-demandas/demandas/",
          results: Array.from({ length: 2 }, (_, i) => ({ id: i + 21 })),
        },
      });

    const resultado = await listarDemandas();

    expect(resultado).toHaveLength(22);
    expect(apiGetMock).toHaveBeenCalledTimes(2);

    const [urlSegundaChamada, configSegundaChamada] = apiGetMock.mock.calls[1];
    expect(urlSegundaChamada).toBe("/modulos/gestao-demandas/demandas/");
    expect(configSegundaChamada?.params).toMatchObject({ page: 2 });
  });

  it("preserva os filtros em todas as páginas seguidas", async () => {
    apiGetMock
      .mockResolvedValueOnce({
        data: {
          count: 21,
          next: "https://operacoes-web-backend.onrender.com/api/modulos/gestao-demandas/demandas/?page=2&search=zebra",
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })),
        },
      })
      .mockResolvedValueOnce({
        data: { count: 21, next: null, previous: null, results: [{ id: 21 }] },
      });

    await listarDemandas({ search: "zebra" });

    const [, configSegundaChamada] = apiGetMock.mock.calls[1];
    expect(configSegundaChamada?.params).toMatchObject({ search: "zebra", page: 2 });
  });

  it("para de seguir se o next não trouxer o parâmetro page (defensivo)", async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        count: 1,
        next: "https://operacoes-web-backend.onrender.com/algum-endpoint-sem-page/",
        previous: null,
        results: [{ id: 1 }],
      },
    });

    const resultado = await listarDemandas();

    expect(resultado).toEqual([{ id: 1 }]);
    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });
});
