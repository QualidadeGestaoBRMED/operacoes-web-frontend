import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "next-auth/react";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

// O módulo guarda estado (renovação em andamento, sessão já encerrada): cada
// teste importa uma cópia nova.
async function carregar() {
  vi.resetModules();
  return import("./renovarSessao");
}

function resposta(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(signOut).mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renovarSessao (STC-611)", () => {
  it("renova pela rota de sessão e devolve true", async () => {
    const { renovarSessao } = await carregar();
    fetchMock.mockResolvedValue(resposta(200));

    await expect(renovarSessao()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/sessao/renovar", { method: "POST" });
  });

  it("chamadas concorrentes esperam a mesma renovação", async () => {
    const { renovarSessao } = await carregar();
    let concluir!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (concluir = r)));

    const chamadas = [renovarSessao(), renovarSessao(), renovarSessao()];
    concluir(resposta(200));

    await expect(Promise.all(chamadas)).resolves.toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("503 (renovação em andamento no backend) espera o Retry-After e tenta de novo", async () => {
    vi.useFakeTimers();
    const { renovarSessao } = await carregar();
    fetchMock
      .mockResolvedValueOnce(resposta(503, { "Retry-After": "2" }))
      .mockResolvedValueOnce(resposta(200));

    const renovacao = renovarSessao();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(renovacao).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("desiste depois de 3 respostas 503 seguidas", async () => {
    vi.useFakeTimers();
    const { renovarSessao } = await carregar();
    fetchMock.mockResolvedValue(resposta(503, { "Retry-After": "1" }));

    const renovacao = renovarSessao();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(renovacao).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("401 (sessão inválida de verdade) não tenta de novo", async () => {
    const { renovarSessao } = await carregar();
    fetchMock.mockResolvedValue(resposta(401));

    await expect(renovarSessao()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede devolve false", async () => {
    const { renovarSessao } = await carregar();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(renovarSessao()).resolves.toBe(false);
  });

  it("depois de terminar, uma chamada nova faz outra renovação", async () => {
    const { renovarSessao } = await carregar();
    fetchMock.mockResolvedValue(resposta(200));

    await renovarSessao();
    await renovarSessao();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("encerrarSessao (STC-611)", () => {
  it("chama signOut uma vez só, mesmo chamado várias vezes", async () => {
    const { encerrarSessao } = await carregar();

    encerrarSessao();
    encerrarSessao();
    encerrarSessao();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});

describe("fetchComRenovacao (STC-611)", () => {
  it("resposta que não é 401 passa direto, sem renovar", async () => {
    const { fetchComRenovacao } = await carregar();
    fetchMock.mockResolvedValue(resposta(200));

    const r = await fetchComRenovacao("/api/media/evidencia-vigente?documento=1");

    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 renova e repete a requisição", async () => {
    const { fetchComRenovacao } = await carregar();
    fetchMock
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200))
      .mockResolvedValueOnce(resposta(200));

    const r = await fetchComRenovacao("/api/media/evidencia-vigente?documento=1");

    expect(r.status).toBe(200);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/media/evidencia-vigente?documento=1",
      "/api/sessao/renovar",
      "/api/media/evidencia-vigente?documento=1",
    ]);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("renovação recusada leva ao login", async () => {
    const { fetchComRenovacao } = await carregar();
    fetchMock.mockResolvedValueOnce(resposta(401)).mockResolvedValueOnce(resposta(401));

    const r = await fetchComRenovacao("/api/media/evidencia-vigente?documento=1");

    expect(r.status).toBe(401);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("401 de novo depois de renovar leva ao login, sem renovar outra vez", async () => {
    const { fetchComRenovacao } = await carregar();
    fetchMock
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200))
      .mockResolvedValueOnce(resposta(401));

    await fetchComRenovacao("/api/media/evidencia-vigente?documento=1");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
