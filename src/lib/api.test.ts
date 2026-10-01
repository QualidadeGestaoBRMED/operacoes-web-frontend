import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "next-auth/react";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

// O interceptor depende do estado de renovarSessao.ts (renovação em
// andamento, sessão encerrada): cada teste importa cópias novas dos dois.
async function carregar(respostasDoBackend: number[]) {
  vi.resetModules();
  const { default: api } = await import("./api");
  const fila = [...respostasDoBackend];
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    const status = fila.shift() ?? 200;
    const resposta = { data: {}, status, statusText: "", headers: {}, config };
    if (status >= 400) {
      throw new AxiosError("erro", undefined, config, undefined, resposta);
    }
    return resposta;
  }) satisfies AxiosAdapter;
  api.defaults.adapter = adapter;
  return { api, adapter };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(signOut).mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("interceptor de 401 do api.ts (STC-611)", () => {
  it("401 renova a sessão e repete a requisição", async () => {
    const { api, adapter } = await carregar([401, 200]);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const resposta = await api.get("/plataforma/modulos/");

    expect(resposta.status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/sessao/renovar", { method: "POST" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("rajada de 401: uma única renovação, e todas as requisições repetidas", async () => {
    const { api, adapter } = await carregar([401, 401, 401, 401, 200, 200, 200, 200]);
    let concluir!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (concluir = r)));

    const chamadas = ["/a/", "/b/", "/c/", "/d/"].map((url) => api.get(url));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    concluir(new Response(null, { status: 200 }));

    const respostas = await Promise.all(chamadas);
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(8);
  });

  it("renovação recusada leva ao login e rejeita a requisição", async () => {
    const { api } = await carregar([401]);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(api.get("/plataforma/modulos/")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("401 de novo na requisição repetida leva ao login, sem renovar outra vez", async () => {
    const { api, adapter } = await carregar([401, 401]);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(api.get("/plataforma/modulos/")).rejects.toBeDefined();
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("sessão inválida numa rajada chama signOut uma vez só", async () => {
    const { api } = await carregar([401, 401, 401]);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await Promise.allSettled(["/a/", "/b/", "/c/"].map((url) => api.get(url)));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("erro que não é 401 não renova nem desloga", async () => {
    const { api } = await carregar([500]);

    await expect(api.get("/plataforma/modulos/")).rejects.toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
