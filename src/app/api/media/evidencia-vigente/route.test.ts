import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obterTokenBackend } from "@/lib/authBackend";
import { GET } from "./route";

vi.mock("@/lib/authBackend", () => ({ obterTokenBackend: vi.fn() }));

process.env.NEXT_PUBLIC_API_URL = "http://backend.teste";
const fetchMock = vi.fn();

function requisicao(documento = "7") {
  return new NextRequest(
    `http://localhost:3000/api/media/evidencia-vigente?documento=${documento}`,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(obterTokenBackend).mockResolvedValue({
    backendAccessToken: "access",
    backendRefreshToken: "refresh",
  } as never);
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("GET /api/media/evidencia-vigente (STC-611)", () => {
  it("401 do backend (access expirado) volta 401, sem renovar aqui", async () => {
    // 401 é o sinal pro navegador renovar a sessão e repetir (fetchComRenovacao).
    // Como 502, o preview nunca se recuperaria.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const resposta = await GET(requisicao());

    expect(resposta.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/auth/refresh/");
  });

  it("404 do backend continua 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    expect((await GET(requisicao())).status).toBe(404);
  });

  it("outro erro do backend continua 502", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    expect((await GET(requisicao())).status).toBe(502);
  });

  it("serve o PDF da evidência vigente", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json([
          { arquivo: "/media/antiga.pdf", vigente: false },
          { arquivo: "/media/vigente.pdf", vigente: true },
        ]),
      )
      .mockResolvedValueOnce(new Response("%PDF-fake"));

    const resposta = await GET(requisicao());

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/pdf");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/media/vigente.pdf");
  });
});
