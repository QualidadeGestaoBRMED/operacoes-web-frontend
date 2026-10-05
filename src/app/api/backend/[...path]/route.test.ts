import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obterTokenBackend } from "@/lib/authBackend";
import { GET, POST } from "./route";

vi.mock("@/lib/authBackend", () => ({ obterTokenBackend: vi.fn() }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://backend:8000");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ ok: true }));
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.mocked(obterTokenBackend).mockResolvedValue({ backendAccessToken: "access" } as never);
});

function contexto(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("proxy /api/backend repassa IP e navegador (STC-637)", () => {
  it("envia o IP e o navegador de quem chamou, além do token", async () => {
    const requisicao = new NextRequest("http://localhost:3000/api/backend/auth/me", {
      headers: {
        "x-forwarded-for": "200.10.20.30, 76.76.21.21",
        "user-agent": "Mozilla/5.0 Teste",
      },
    });

    await GET(requisicao, contexto("auth", "me"));

    const cabecalhos = fetchMock.mock.calls[0][1].headers;
    expect(cabecalhos).toMatchObject({
      "X-Forwarded-For": "200.10.20.30",
      "User-Agent": "Mozilla/5.0 Teste",
      Authorization: "Bearer access",
    });
  });

  it("um Authorization vindo do navegador nunca substitui o da sessão", async () => {
    const requisicao = new NextRequest("http://localhost:3000/api/backend/plataforma/usuarios/1", {
      method: "POST",
      headers: {
        authorization: "Bearer forjado",
        "content-type": "application/json",
        "x-forwarded-for": "200.10.20.30",
      },
      body: "{}",
    });

    await POST(requisicao, contexto("plataforma", "usuarios", "1"));

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer access");
  });
});

describe("proxy /api/backend manda o segredo do proxy (STC-651)", () => {
  it("com ATLAS_PROXY_SEGREDO, o backend recebe o X-Atlas-Proxy; o do navegador é ignorado", async () => {
    vi.stubEnv("ATLAS_PROXY_SEGREDO", "segredo-do-servidor");
    const requisicao = new NextRequest("http://localhost:3000/api/backend/auth/me", {
      headers: {
        "x-atlas-proxy": "forjado-pelo-navegador",
        "x-forwarded-for": "200.10.20.30",
      },
    });

    await GET(requisicao, contexto("auth", "me"));

    const cabecalhos = fetchMock.mock.calls[0][1].headers;
    expect(cabecalhos["X-Atlas-Proxy"]).toBe("segredo-do-servidor");
    expect(JSON.stringify(cabecalhos)).not.toContain("forjado-pelo-navegador");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
