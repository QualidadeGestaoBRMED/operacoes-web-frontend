import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { baixarArquivo, buscarArquivo } from "./download";
import { extrairMensagemErro } from "./erros";

vi.mock("./api", () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("buscarArquivo (STC-963)", () => {
  it("pede como Blob e usa o nome do Content-Disposition", async () => {
    const arquivo = new Blob(["planilha"]);
    vi.mocked(api.get).mockResolvedValue({
      data: arquivo,
      headers: { "content-disposition": 'attachment; filename="relatorio_2026-11-03.xlsx"' },
    });

    const resultado = await buscarArquivo("/modulos/x/exportar/", { a: "1" }, "padrao.xlsx");

    expect(api.get).toHaveBeenCalledWith("/modulos/x/exportar/", {
      params: { a: "1" },
      responseType: "blob",
    });
    expect(resultado).toEqual({ arquivo, nome: "relatorio_2026-11-03.xlsx" });
  });

  it("sem Content-Disposition, o nome de quem chamou", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob([]), headers: {} });

    const { nome } = await buscarArquivo("/x/", {}, "padrao.xlsx");

    expect(nome).toBe("padrao.xlsx");
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

    const erro = await buscarArquivo("/x/", {}, "padrao.xlsx").catch((falha: unknown) => falha);

    expect(extrairMensagemErro(erro)).toContain("Coluna inválida: email.");
  });

  it("erro em Blob que não é JSON não quebra: vira a mensagem padrão", async () => {
    const resposta = {
      status: 502,
      data: new Blob(["<html>Bad Gateway</html>"]),
      headers: {},
      config: { headers: new AxiosHeaders() },
      statusText: "Bad Gateway",
    } as AxiosResponse;
    vi.mocked(api.get).mockRejectedValue(new AxiosError("Bad Gateway", "502", undefined, undefined, resposta));

    const erro = await buscarArquivo("/x/", {}, "padrao.xlsx").catch((falha: unknown) => falha);

    expect(extrairMensagemErro(erro)).toBeTruthy();
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
