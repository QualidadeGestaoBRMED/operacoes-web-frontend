import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import type { Demanda } from "@/types";
import {
  buscarPrimeiraPaginaDaFase,
  juntarSemRepetir,
  listarPaginasExtrasDaFase,
} from "./demandas";

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

function erro404() {
  return Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } });
}

function paramsDaChamada(chamada: number) {
  return (apiGetMock.mock.calls[chamada][1] as { params: Record<string, unknown> }).params;
}

describe("buscarPrimeiraPaginaDaFase (STC-931)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("pede a fase com os filtros, sem página", async () => {
    apiGetMock.mockResolvedValueOnce(paginaMock([1, 2], 47, "https://x/?page=2"));

    const pagina = await buscarPrimeiraPaginaDaFase({ tipo_gestao: 2, search: "zebra" }, "backlog");

    expect(paramsDaChamada(0)).toEqual({ tipo_gestao: 2, search: "zebra", status: "backlog" });
    expect(pagina.count).toBe(47);
  });
});

describe("listarPaginasExtrasDaFase (STC-931)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("busca as páginas 2 até a pedida em paralelo, com a fase em todas", async () => {
    apiGetMock.mockImplementation(async (_url, config) => {
      const page = (config as { params: { page: number } }).params.page;
      return page === 2
        ? paginaMock([3, 4], 6, "https://x/?page=3")
        : paginaMock([5, 6], 6, null);
    });

    const extras = await listarPaginasExtrasDaFase({ tipo_gestao: 2 }, "concluido", 3);

    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(paramsDaChamada(0)).toEqual({ tipo_gestao: 2, status: "concluido", page: 2 });
    expect(paramsDaChamada(1)).toEqual({ tipo_gestao: 2, status: "concluido", page: 3 });
    expect(extras.demandas.map((d) => d.id)).toEqual([3, 4, 5, 6]);
    expect(extras).toMatchObject({ ate: 3, temMais: false });
  });

  it("muitas páginas vão em lotes de 4, um lote depois do outro", async () => {
    let emVoo = 0;
    let maximo = 0;
    apiGetMock.mockImplementation(async (_url, config) => {
      emVoo += 1;
      maximo = Math.max(maximo, emVoo);
      await new Promise((resolve) => setTimeout(resolve, 0));
      emVoo -= 1;
      const page = (config as { params: { page: number } }).params.page;
      return paginaMock([page], 10, page < 10 ? "https://x/?page=next" : null);
    });

    const extras = await listarPaginasExtrasDaFase(undefined, "concluido", 10);

    expect(apiGetMock).toHaveBeenCalledTimes(9);
    expect(maximo).toBe(4);
    expect(extras.demandas.map((d) => d.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(extras).toMatchObject({ ate: 10, temMais: false });
  });

  it("a partir de uma página: busca só a pedida (carregar mais)", async () => {
    apiGetMock.mockResolvedValueOnce(paginaMock([7, 8], 8, null));

    const extras = await listarPaginasExtrasDaFase(undefined, "backlog", 4, 4);

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(paramsDaChamada(0)).toEqual({ status: "backlog", page: 4 });
    expect(extras).toMatchObject({ ate: 4, temMais: false });
  });

  it("página que deixou de existir (fase encolheu) marca o fim, sem erro", async () => {
    apiGetMock
      .mockResolvedValueOnce(paginaMock([3], 3, null))
      .mockRejectedValueOnce(erro404());

    const extras = await listarPaginasExtrasDaFase(undefined, "backlog", 3);

    expect(extras).toMatchObject({ ate: 2, temMais: false });
    expect(extras.demandas.map((d) => d.id)).toEqual([3]);
  });

  it("outro erro sobe para a coluna mostrar", async () => {
    apiGetMock.mockRejectedValueOnce(new Error("timeout"));

    await expect(listarPaginasExtrasDaFase(undefined, "backlog", 2)).rejects.toThrow("timeout");
  });
});

describe("juntarSemRepetir (STC-931)", () => {
  it("fica a primeira ocorrência do card repetido entre páginas", () => {
    const resultado = juntarSemRepetir(
      [{ id: 1 }, { id: 2 }] as Demanda[],
      [{ id: 2 }, { id: 3 }] as Demanda[],
    );

    expect(resultado.map((d) => d.id)).toEqual([1, 2, 3]);
  });
});
