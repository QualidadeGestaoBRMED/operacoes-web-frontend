import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { extrairMensagemErro } from "./erros";
import {
  baixarArquivo,
  colunasLembradas,
  exportarSituacao,
  lembrarColunas,
} from "./legalizacaoExportacao";

vi.mock("./api", () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  window.localStorage.clear();
});

describe("exportarSituacao (STC-963)", () => {
  it("manda os parâmetros e devolve o arquivo com o nome do backend", async () => {
    const arquivo = new Blob(["planilha"]);
    vi.mocked(api.get).mockResolvedValue({
      data: arquivo,
      headers: { "content-disposition": 'attachment; filename="situacao-legalizacao_cadastrados_2026-11-03.xlsx"' },
    });

    const resultado = await exportarSituacao({
      recorte: "cadastrados",
      unidades: [2, 3],
      categorias: ["equipamentos", "residuos"],
      colunas: ["responsavel", "link"],
      rede: "opex",
    });

    expect(api.get).toHaveBeenCalledWith("/modulos/legalizacao/documentos/exportar/", {
      params: {
        recorte: "cadastrados",
        unidade: "2,3",
        categoria: "equipamentos,residuos",
        colunas: "responsavel,link",
        rede: "opex",
      },
      responseType: "blob",
    });
    expect(resultado).toEqual({
      arquivo,
      nome: "situacao-legalizacao_cadastrados_2026-11-03.xlsx",
    });
  });

  it("sem escolha, não manda unidade, categoria nem colunas", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob([]), headers: {} });

    const { nome } = await exportarSituacao({ recorte: "todos", unidades: [], categorias: [], colunas: [] });

    expect(vi.mocked(api.get).mock.calls[0][1]?.params).toEqual({
      recorte: "todos",
      unidade: undefined,
      categoria: undefined,
      colunas: undefined,
      rede: undefined,
    });
    expect(nome).toBe("situacao-legalizacao.xlsx");
  });

  it("erro do backend em Blob vira mensagem legível", async () => {
    const resposta = {
      status: 400,
      data: new Blob([JSON.stringify({ colunas: ["Coluna inválida: email."] })]),
      headers: {},
      config: { headers: new AxiosHeaders() },
      statusText: "Bad Request",
    } as AxiosResponse;
    vi.mocked(api.get).mockRejectedValue(new AxiosError("Bad Request", "400", undefined, undefined, resposta));

    const erro = await exportarSituacao({ recorte: "todos", unidades: [], categorias: [], colunas: [] }).catch(
      (falha: unknown) => falha,
    );

    expect(extrairMensagemErro(erro)).toContain("Coluna inválida: email.");
  });
});

describe("colunas lembradas", () => {
  it("sem escolha guardada, as do padrão", () => {
    expect(colunasLembradas(7)).toEqual(["dias_para_vencer", "responsavel", "area_responsavel", "renovacao"]);
  });

  it("guarda por pessoa e ignora coluna que não existe mais", () => {
    lembrarColunas(7, ["link"]);
    window.localStorage.setItem("atlas.legalizacao.exportacao.colunas.8", JSON.stringify(["link", "email"]));

    expect(colunasLembradas(7)).toEqual(["link"]);
    expect(colunasLembradas(8)).toEqual(["link"]);
  });

  it("valor guardado estragado volta para o padrão", () => {
    window.localStorage.setItem("atlas.legalizacao.exportacao.colunas.7", "{");
    expect(colunasLembradas(7)).toEqual(["dias_para_vencer", "responsavel", "area_responsavel", "renovacao"]);
  });
});

describe("baixarArquivo", () => {
  it("baixa com o nome do backend e só libera o arquivo depois", () => {
    vi.useFakeTimers();
    const criar = vi.fn(() => "blob:planilha");
    const revogar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    baixarArquivo({ arquivo: new Blob(["x"]), nome: "situacao.xlsx" });

    const link = clique.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("situacao.xlsx");
    expect(link.href).toBe("blob:planilha");
    expect(revogar).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revogar).toHaveBeenCalledWith("blob:planilha");
    clique.mockRestore();
    vi.useRealTimers();
  });
});
