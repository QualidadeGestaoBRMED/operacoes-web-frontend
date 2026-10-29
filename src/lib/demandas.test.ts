import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import { listarDemandasDaFase } from "./demandas";

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

describe("listarDemandasDaFase (STC-931)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  function paginaPedida(chamada: number) {
    return (apiGetMock.mock.calls[chamada][1] as { params: Record<string, unknown> }).params;
  }

  it("pede a fase com os filtros e devolve o total da fase", async () => {
    apiGetMock.mockResolvedValueOnce(paginaMock([1, 2], 47, "https://x/demandas/?page=2"));

    const resultado = await listarDemandasDaFase({ tipo_gestao: 2, search: "zebra" }, "backlog", 1);

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(paginaPedida(0)).toEqual({ tipo_gestao: 2, search: "zebra", status: "backlog" });
    expect(resultado).toMatchObject({ total: 47, paginas: 1, temMais: true });
    expect(resultado.demandas.map((d) => d.id)).toEqual([1, 2]);
  });

  it("busca as páginas pedidas em sequência, com a fase em todas", async () => {
    apiGetMock
      .mockResolvedValueOnce(paginaMock([1, 2], 6, "https://x/?page=2"))
      .mockResolvedValueOnce(paginaMock([3, 4], 6, "https://x/?page=3"))
      .mockResolvedValueOnce(paginaMock([5, 6], 6, null));

    const resultado = await listarDemandasDaFase({ tipo_gestao: 2 }, "concluido", 3);

    expect(paginaPedida(1)).toEqual({ tipo_gestao: 2, status: "concluido", page: 2 });
    expect(paginaPedida(2)).toEqual({ tipo_gestao: 2, status: "concluido", page: 3 });
    expect(resultado.demandas.map((d) => d.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(resultado).toMatchObject({ paginas: 3, temMais: false });
  });

  it("para quando a fase acaba, sem pedir página que não existe", async () => {
    apiGetMock.mockResolvedValueOnce(paginaMock([1], 1, null));

    const resultado = await listarDemandasDaFase(undefined, "em_revisao", 3);

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ paginas: 1, temMais: false });
  });

  it("descarta o card repetido entre páginas (demanda nova deslocou a seguinte)", async () => {
    apiGetMock
      .mockResolvedValueOnce(paginaMock([1, 2], 4, "https://x/?page=2"))
      .mockResolvedValueOnce(paginaMock([2, 3], 4, null));

    const resultado = await listarDemandasDaFase(undefined, "backlog", 2);

    expect(resultado.demandas.map((d) => d.id)).toEqual([1, 2, 3]);
  });
});
