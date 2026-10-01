import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obterTokenBackend } from "@/lib/authBackend";

vi.mock("@/lib/authBackend", () => ({ obterTokenBackend: vi.fn() }));
// O encode() de verdade (jose) recusa o Uint8Array do jsdom (outro realm);
// aqui só importa o que a rota faz com o resultado.
vi.mock("next-auth/jwt", () => ({ encode: vi.fn(async () => "cookie-codificado") }));

const fetchMock = vi.fn();

function requisicao() {
  return new NextRequest("http://localhost:3000/api/sessao/renovar", { method: "POST" });
}

async function carregar() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(obterTokenBackend).mockReset();
  vi.mocked(encode).mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("POST /api/sessao/renovar (STC-611)", () => {
  it("sem sessão no cookie devolve 401 sem chamar o backend", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue(null);

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renova com o refresh do cookie atual e regrava o cookie de sessão", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({
      backendAccessToken: "access-velho",
      backendRefreshToken: "refresh-do-cookie-atual",
    } as never);
    fetchMock.mockResolvedValue(
      Response.json({ access: "access-novo", refresh: "refresh-novo" }),
    );

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refresh: "refresh-do-cookie-atual",
    });
    expect(vi.mocked(encode).mock.calls[0][0].token).toMatchObject({
      backendAccessToken: "access-novo",
      backendRefreshToken: "refresh-novo",
    });
    expect(resposta.headers.get("set-cookie")).toMatch(
      /authjs\.session-token=cookie-codificado/,
    );
  });

  it("503 do backend (renovação em andamento) volta 503 com o mesmo Retry-After", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({
      backendRefreshToken: "refresh",
    } as never);
    fetchMock.mockResolvedValue(new Response(null, { status: 503, headers: { "Retry-After": "2" } }));

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(503);
    expect(resposta.headers.get("Retry-After")).toBe("2");
    expect(resposta.headers.get("set-cookie")).toBeNull();
  });

  it("503 sem Retry-After assume 1 segundo", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({ backendRefreshToken: "refresh" } as never);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const resposta = await POST(requisicao());

    expect(resposta.headers.get("Retry-After")).toBe("1");
  });

  it("refresh recusado pelo backend devolve 401", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({ backendRefreshToken: "refresh" } as never);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("set-cookie")).toBeNull();
  });

  it("backend fora do ar devolve 401", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({ backendRefreshToken: "refresh" } as never);
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(401);
  });

  it("duas renovações simultâneas com o mesmo refresh fazem uma só ida ao backend", async () => {
    const { POST } = await carregar();
    vi.mocked(obterTokenBackend).mockResolvedValue({ backendRefreshToken: "refresh" } as never);
    let concluir!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (concluir = r)));

    const chamadas = [POST(requisicao()), POST(requisicao())];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    concluir(Response.json({ access: "a", refresh: "r" }));

    const respostas = await Promise.all(chamadas);
    expect(respostas.map((r) => r.status)).toEqual([200, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
