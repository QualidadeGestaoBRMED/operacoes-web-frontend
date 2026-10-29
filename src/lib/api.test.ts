import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // signOut() de verdade devolve uma Promise (encerrarSessao usa o .catch).
  vi.mocked(signOut).mockReset().mockResolvedValue(undefined as never);
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

  it("renovação indisponível (sem rede, backend fora do ar) rejeita a requisição sem deslogar", async () => {
    const { api, adapter } = await carregar([401]);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.get("/plataforma/modulos/")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("503 da renovação que não passa rejeita a requisição sem deslogar", async () => {
    vi.useFakeTimers();
    const { api } = await carregar([401]);
    fetchMock.mockResolvedValue(new Response(null, { status: 503, headers: { "Retry-After": "1" } }));

    const chamada = api.get("/plataforma/modulos/");
    const verificacao = expect(chamada).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(5_000);
    await verificacao;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(signOut).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("erro que não é 401 não renova nem desloga", async () => {
    const { api } = await carregar([500]);

    await expect(api.get("/plataforma/modulos/")).rejects.toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("renovação extra evitada no interceptor (STC-611)", () => {
  it("401 de requisição que saiu antes da renovação terminar só repete, sem nova renovação", async () => {
    vi.resetModules();
    const { default: api } = await import("./api");
    const { renovarSessao } = await import("./renovarSessao");
    let liberarPrimeira!: () => void;
    const respostas = [401, 200];
    let chamada = 0;
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (chamada++ === 0) await new Promise<void>((r) => (liberarPrimeira = r));
      const status = respostas.shift()!;
      const resposta = { data: {}, status, statusText: "", headers: {}, config };
      if (status >= 400) throw new AxiosError("erro", undefined, config, undefined, resposta);
      return resposta;
    }) satisfies AxiosAdapter;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    // A requisição sai, outra renovação termina enquanto ela está a caminho,
    // e só então chega o 401 dela (levou o cookie antigo).
    const original = api.get("/plataforma/modulos/");
    await vi.waitFor(() => expect(liberarPrimeira).toBeDefined());
    await renovarSessao();
    liberarPrimeira();

    expect((await original).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("ver como (STC-790)", () => {
  const SESSAO = {
    id: "6f1c2a7e-0000-4000-8000-000000000001",
    usuario: { id: 7, nome: "Coordenação" },
    admin: { id: 1, nome: "Admin" },
    iniciada_em: "2026-10-19T12:00:00Z",
    expira_em: new Date(Date.now() + 3_600_000).toISOString(),
  };

  beforeEach(() => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("leitura vai com o id da sessão no X-Ver-Como", async () => {
    const { api, adapter } = await carregar([200]);

    await api.get("/modulos/gestao-demandas/demandas/");

    expect(adapter.mock.calls[0][0].headers.get("X-Ver-Como")).toBe(SESSAO.id);
  });

  it("escrita nem sai: recusa com a mensagem de somente leitura", async () => {
    const { api, adapter } = await carregar([200]);
    const { extrairMensagemErro } = await import("./erros");

    const erro = await api.post("/modulos/gestao-demandas/demandas/", {}).catch((e) => e);

    expect(adapter).not.toHaveBeenCalled();
    expect(erro.response.status).toBe(403);
    expect(erro.response.data.codigo).toBe("ver_como_somente_leitura");
    expect(extrairMensagemErro(erro)).toBe(
      "Somente leitura no modo ver como: saia do ver como para fazer alterações.",
    );
  });

  it("começar e sair vão como o próprio Admin, sem o cabeçalho", async () => {
    const { api, adapter } = await carregar([204]);

    await api.post(`/plataforma/ver-como/${SESSAO.id}/encerrar/`, null, { _semVerComo: true });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].headers.get("X-Ver-Como")).toBeUndefined();
  });

  it("sessão que não vale mais no backend: sai do ver como, com o aviso", async () => {
    const navegar = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: navegar });
    vi.resetModules();
    const { default: api } = await import("./api");
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError("erro", undefined, config, undefined, {
        data: { detail: "O ver como terminou.", codigo: "ver_como_encerrado" },
        status: 403,
        statusText: "",
        headers: {},
        config,
      });
    });

    await api.get("/auth/me/").catch(() => {});

    expect(navegar).toHaveBeenCalledWith("/admin/permissoes");
    expect(sessionStorage.getItem("atlas.verComo")).toBeNull();
    expect(sessionStorage.getItem("atlas.verComoAviso")).toBe("O ver como terminou.");
  });

  it("recusa de fim numa chamada como o Admin (sair) não navega de novo", async () => {
    const navegar = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: navegar });
    vi.resetModules();
    const { default: api } = await import("./api");
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError("erro", undefined, config, undefined, {
        data: { detail: "O ver como terminou.", codigo: "ver_como_encerrado" },
        status: 403,
        statusText: "",
        headers: {},
        config,
      });
    });

    await api.post(`/plataforma/ver-como/${SESSAO.id}/encerrar/`, null, { _semVerComo: true }).catch(() => {});

    expect(navegar).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("atlas.verComoAviso")).toBeNull();
  });
});

describe("endereço sem a barra final (STC-932)", () => {
  it("tira a barra final do caminho, antes do ?, e deixa o resto como está", async () => {
    const { semBarraFinal } = await import("./api");

    expect(semBarraFinal("/modulos/legalizacao/documentos/")).toBe("/modulos/legalizacao/documentos");
    expect(semBarraFinal("/modulos/legalizacao/documentos/?rede=padrao")).toBe(
      "/modulos/legalizacao/documentos?rede=padrao",
    );
    expect(semBarraFinal("/demandas/12/anexos/#topo")).toBe("/demandas/12/anexos#topo");
    expect(semBarraFinal("/auth/me")).toBe("/auth/me");
    expect(semBarraFinal("/")).toBe("/");
    expect(semBarraFinal(undefined)).toBeUndefined();
  });

  it("endereço absoluto (ex.: URL assinada) fica como veio", async () => {
    const { semBarraFinal } = await import("./api");

    expect(semBarraFinal("https://r2.exemplo.com/bucket/arquivo/")).toBe(
      "https://r2.exemplo.com/bucket/arquivo/",
    );
  });

  it.each(["get", "post", "patch", "delete"] as const)(
    "%s sai sem a barra final, com os parâmetros intactos",
    async (metodo) => {
      const { api, adapter } = await carregar([200]);

      await api.request({ method: metodo, url: "/modulos/gestao-demandas/demandas/", params: { status: "backlog" } });

      const enviada = adapter.mock.calls[0][0];
      expect(enviada.url).toBe("/modulos/gestao-demandas/demandas");
      expect(enviada.params).toEqual({ status: "backlog" });
    },
  );

  it("a requisição repetida depois de renovar a sessão também vai sem a barra", async () => {
    const { api, adapter } = await carregar([401, 200]);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await api.get("/auth/me/");

    expect(adapter.mock.calls.map((c) => c[0].url)).toEqual(["/auth/me", "/auth/me"]);
  });
});
