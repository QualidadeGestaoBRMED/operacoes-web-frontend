import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callbackJwt, invalidarRefreshNoBackend } from "./auth";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.mocked(headers).mockResolvedValue(
    new Headers({ "x-forwarded-for": "200.10.20.30", "user-agent": "Mozilla/5.0 Teste" }) as never,
  );
});

describe("login com Google repassa IP e navegador (STC-637)", () => {
  it("a troca do token do Google leva o IP e o navegador de quem está entrando", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ access: "a", refresh: "r", user: { id: 1 } }),
    );

    await callbackJwt({
      token: {},
      account: { id_token: "id-token-do-google" } as never,
    });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/google\/$/);
    expect(opcoes.headers).toEqual({
      "X-Forwarded-For": "200.10.20.30",
      "User-Agent": "Mozilla/5.0 Teste",
      "Content-Type": "application/json",
    });
  });
});

describe("logout repassa IP e navegador (STC-637)", () => {
  it("a revogação do refresh leva o IP e o navegador de quem saiu", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await invalidarRefreshNoBackend("refresh");

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/logout\/$/);
    expect(opcoes.headers).toMatchObject({
      "X-Forwarded-For": "200.10.20.30",
      "User-Agent": "Mozilla/5.0 Teste",
    });
  });
});

describe("login e logout mandam o segredo do proxy (STC-651)", () => {
  it("a troca do token do Google e o logout levam o X-Atlas-Proxy", async () => {
    vi.stubEnv("ATLAS_PROXY_SEGREDO", "segredo-do-servidor");
    fetchMock.mockResolvedValue(Response.json({ access: "a", refresh: "r", user: { id: 1 } }));

    await callbackJwt({ token: {}, account: { id_token: "id-token-do-google" } as never });
    await invalidarRefreshNoBackend("refresh");

    for (const [, opcoes] of fetchMock.mock.calls) {
      expect(opcoes.headers["X-Atlas-Proxy"]).toBe("segredo-do-servidor");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
