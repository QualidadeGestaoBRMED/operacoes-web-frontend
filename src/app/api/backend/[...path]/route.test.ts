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

describe("proxy /api/backend repassa o ver como (STC-790)", () => {
  it("passa o X-Ver-Como com id de sessão válido", async () => {
    const id = "6f1c2a7e-0000-4000-8000-000000000001";
    const requisicao = new NextRequest("http://localhost:3000/api/backend/auth/me", {
      headers: { "x-ver-como": id },
    });

    await GET(requisicao, contexto("auth", "me"));

    expect(fetchMock.mock.calls[0][1].headers["X-Ver-Como"]).toBe(id);
  });

  it("ignora um valor que não é id de sessão", async () => {
    const requisicao = new NextRequest("http://localhost:3000/api/backend/auth/me", {
      headers: { "x-ver-como": "7" },
    });

    await GET(requisicao, contexto("auth", "me"));

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-Ver-Como");
  });

  it("sem ver como, sem o cabeçalho", async () => {
    await GET(new NextRequest("http://localhost:3000/api/backend/auth/me"), contexto("auth", "me"));

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-Ver-Como");
  });
});

describe("proxy /api/backend mede o tempo do backend (STC-933)", () => {
  it("devolve o Server-Timing com a duração da chamada ao backend", async () => {
    const agora = vi.spyOn(performance, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1842.34);

    const resposta = await GET(
      new NextRequest("http://localhost:3000/api/backend/modulos/legalizacao/documentos"),
      contexto("modulos", "legalizacao", "documentos"),
    );

    expect(resposta.headers.get("Server-Timing")).toBe("backend;dur=842.3");
    agora.mockRestore();
  });

  it("vale também para resposta de erro do backend, sem mexer no status e no corpo", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Não encontrado." }, { status: 404 }));

    const resposta = await GET(
      new NextRequest("http://localhost:3000/api/backend/modulos/x"),
      contexto("modulos", "x"),
    );

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ detail: "Não encontrado." });
    expect(resposta.headers.get("Server-Timing")).toMatch(/^backend;dur=\d+(\.\d)?$/);
  });

  it("não sai quando o proxy responde sozinho, sem chamar o backend", async () => {
    vi.mocked(obterTokenBackend).mockResolvedValueOnce(null as never);

    const resposta = await GET(
      new NextRequest("http://localhost:3000/api/backend/auth/me"),
      contexto("auth", "me"),
    );

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("Server-Timing")).toBeNull();
  });
});

describe("proxy /api/backend recoloca a barra final (STC-932)", () => {
  it("caminho sem barra chega ao backend com a barra, antes da query", async () => {
    const requisicao = new NextRequest(
      "http://localhost:3000/api/backend/modulos/legalizacao/documentos?rede=padrao",
    );

    await GET(requisicao, contexto("modulos", "legalizacao", "documentos"));

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://backend:8000/api/modulos/legalizacao/documentos/?rede=padrao",
    );
  });
});

describe("proxy /api/backend repassa download de arquivo (STC-963)", () => {
  it("corpo binário chega inteiro, com o nome do arquivo", async () => {
    // Bytes que não são texto válido: lidos como texto, viriam trocados.
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x80]);
    fetchMock.mockResolvedValueOnce(
      new Response(bytes, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="situacao-legalizacao_todos_2026-11-03.xlsx"',
        },
      }),
    );

    const resposta = await GET(
      new NextRequest("http://localhost:3000/api/backend/modulos/legalizacao/documentos/exportar"),
      contexto("modulos", "legalizacao", "documentos", "exportar"),
    );

    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(bytes);
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="situacao-legalizacao_todos_2026-11-03.xlsx"',
    );
  });

  it("sem Content-Disposition no backend, o proxy não inventa um", async () => {
    const resposta = await GET(
      new NextRequest("http://localhost:3000/api/backend/modulos/x"),
      contexto("modulos", "x"),
    );

    expect(resposta.headers.get("Content-Disposition")).toBeNull();
    expect(await resposta.json()).toEqual({ ok: true });
  });
});
