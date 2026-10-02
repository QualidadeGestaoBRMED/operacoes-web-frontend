import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import { extrairMensagemErro } from "./erros";
import { ErroEnvioArquivo, enviarArquivo } from "./uploadDireto";

vi.mock("./api", () => ({
  default: { post: vi.fn() },
}));

const apiPost = vi.mocked(api.post);
const URL_BASE = "/api/modulos/gestao-demandas/demandas/12/anexos/";
const PREPARACAO_DIRETA = {
  modo: "direto",
  url: "https://conta.r2.cloudflarestorage.com/atlas/_uploads_pendentes/x.pdf?X-Amz-Signature=abc",
  metodo: "PUT",
  cabecalhos: { "Content-Type": "application/pdf", "Content-Disposition": "attachment" },
  token: "token-assinado",
};

// XMLHttpRequest falso: guarda o que foi pedido e deixa o teste decidir o
// desfecho do PUT (status, erro de rede) e o progresso.
class XhrFalso {
  static ultimo: XhrFalso | null = null;
  static desfecho: { status?: number; erroDeRede?: boolean } = { status: 200 };
  metodo = "";
  url = "";
  cabecalhos: Record<string, string> = {};
  corpo: unknown = null;
  status = 0;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    XhrFalso.ultimo = this;
  }
  open(metodo: string, url: string) {
    this.metodo = metodo;
    this.url = url;
  }
  setRequestHeader(nome: string, valor: string) {
    this.cabecalhos[nome] = valor;
  }
  send(corpo: unknown) {
    this.corpo = corpo;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    queueMicrotask(() => {
      if (XhrFalso.desfecho.erroDeRede) {
        this.onerror?.();
        return;
      }
      this.status = XhrFalso.desfecho.status ?? 200;
      this.onload?.();
    });
  }
}

function erroHttp(status: number, data: unknown = {}) {
  return new AxiosError("erro", "ERR", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function arquivo(tamanho = 6 * 1024 * 1024) {
  return new File([new Uint8Array(tamanho)], "laudo.pdf", { type: "application/pdf" });
}

describe("enviarArquivo (STC-628)", () => {
  beforeEach(() => {
    apiPost.mockReset();
    XhrFalso.ultimo = null;
    XhrFalso.desfecho = { status: 200 };
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepara, envia direto ao bucket e confirma com o token", async () => {
    apiPost
      .mockResolvedValueOnce({ data: PREPARACAO_DIRETA })
      .mockResolvedValueOnce({ data: { id: 7 } });
    const enviado = arquivo();

    const resultado = await enviarArquivo(URL_BASE, enviado);

    expect(resultado).toEqual({ id: 7 });
    expect(apiPost).toHaveBeenNthCalledWith(1, `${URL_BASE}preparar-envio/`, {
      nome: "laudo.pdf",
      tamanho: enviado.size,
    });
    expect(XhrFalso.ultimo?.metodo).toBe("PUT");
    expect(XhrFalso.ultimo?.url).toBe(PREPARACAO_DIRETA.url);
    expect(XhrFalso.ultimo?.cabecalhos).toEqual(PREPARACAO_DIRETA.cabecalhos);
    expect(XhrFalso.ultimo?.corpo).toBe(enviado);
    expect(apiPost).toHaveBeenNthCalledWith(2, `${URL_BASE}confirmar-envio/`, {
      token: "token-assinado",
    });
  });

  it("informa o progresso do envio ao bucket", async () => {
    apiPost
      .mockResolvedValueOnce({ data: PREPARACAO_DIRETA })
      .mockResolvedValueOnce({ data: { id: 7 } });
    const aoProgredir = vi.fn();

    await enviarArquivo(URL_BASE, arquivo(), aoProgredir);

    expect(aoProgredir).toHaveBeenCalledWith(0.5);
  });

  it("sem R2, envia em multipart pelo POST de sempre", async () => {
    apiPost
      .mockResolvedValueOnce({ data: { modo: "multipart" } })
      .mockResolvedValueOnce({ data: { id: 8 } });
    const enviado = arquivo(10);

    const resultado = await enviarArquivo(URL_BASE, enviado);

    expect(resultado).toEqual({ id: 8 });
    expect(XhrFalso.ultimo).toBeNull();
    const [url, corpo] = apiPost.mock.calls[1];
    expect(url).toBe(URL_BASE);
    expect((corpo as FormData).get("arquivo")).toBe(enviado);
    expect(apiPost).toHaveBeenCalledTimes(2);
  });

  it.each([404, 405])(
    "backend ainda sem a rota de preparar (%i): cai no multipart",
    async (status) => {
      apiPost.mockRejectedValueOnce(erroHttp(status)).mockResolvedValueOnce({ data: { id: 9 } });

      const resultado = await enviarArquivo(URL_BASE, arquivo(10));

      expect(resultado).toEqual({ id: 9 });
      expect(apiPost.mock.calls[1][0]).toBe(URL_BASE);
    },
  );

  it("recusa do preparar (tipo, tamanho, permissão) sobe com a mensagem do backend", async () => {
    apiPost.mockRejectedValueOnce(
      erroHttp(400, ["Tipo de arquivo não permitido. Aceito: PDF."]),
    );

    const erro = await enviarArquivo(URL_BASE, arquivo()).catch((e: unknown) => e);

    expect(extrairMensagemErro(erro)).toBe("Tipo de arquivo não permitido. Aceito: PDF.");
    expect(XhrFalso.ultimo).toBeNull();
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["recusa do bucket", { status: 403 }],
    ["falha de rede, CORS ou CSP", { erroDeRede: true }],
  ])("%s no PUT: não confirma e mostra mensagem legível", async (_caso, desfecho) => {
    apiPost.mockResolvedValueOnce({ data: PREPARACAO_DIRETA });
    XhrFalso.desfecho = desfecho;

    const erro = await enviarArquivo(URL_BASE, arquivo()).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroEnvioArquivo);
    expect(extrairMensagemErro(erro)).toBe(
      "Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.",
    );
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it("PUT bloqueado (CSP ou CORS) com arquivo pequeno: segue pelo multipart", async () => {
    apiPost
      .mockResolvedValueOnce({ data: PREPARACAO_DIRETA })
      .mockResolvedValueOnce({ data: { id: 10 } });
    XhrFalso.desfecho = { erroDeRede: true };
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const enviado = arquivo(1024 * 1024);

    const resultado = await enviarArquivo(URL_BASE, enviado);

    expect(resultado).toEqual({ id: 10 });
    const [url, corpo] = apiPost.mock.calls[1];
    expect(url).toBe(URL_BASE);
    expect((corpo as FormData).get("arquivo")).toBe(enviado);
    expect(aviso).toHaveBeenCalled();
  });

  it("PUT recusado pelo bucket (403) não cai no multipart, mesmo com arquivo pequeno", async () => {
    apiPost.mockResolvedValueOnce({ data: PREPARACAO_DIRETA });
    XhrFalso.desfecho = { status: 403 };

    const erro = await enviarArquivo(URL_BASE, arquivo(1024)).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroEnvioArquivo);
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it("recusa da confirmação sobe com a mensagem do backend", async () => {
    apiPost
      .mockResolvedValueOnce({ data: PREPARACAO_DIRETA })
      .mockRejectedValueOnce(
        erroHttp(400, { token: ["O envio expirou. Envie o arquivo de novo."] }),
      );

    const erro = await enviarArquivo(URL_BASE, arquivo()).catch((e: unknown) => e);

    expect(extrairMensagemErro(erro)).toBe("O envio expirou. Envie o arquivo de novo.");
  });
});

describe("extrairMensagemErro com 413 da Vercel", () => {
  it("troca o texto cru por mensagem legível", () => {
    const erro = erroHttp(413, "Request Entity Too Large FUNCTION_PAYLOAD_TOO_LARGE");

    expect(extrairMensagemErro(erro)).toBe(
      "Arquivo grande demais para este envio. Tente de novo; se persistir, avise o suporte.",
    );
  });
});
