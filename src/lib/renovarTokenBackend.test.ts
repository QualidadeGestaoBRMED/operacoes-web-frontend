import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O módulo guarda o dedupe de renovações em andamento: cada teste importa
// uma cópia nova.
async function carregar() {
  vi.resetModules();
  return import("./renovarTokenBackend");
}

function jwtComExp(expSegundos: number) {
  const payload = btoa(JSON.stringify({ exp: expSegundos, jti: "x" }))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `cabecalho.${payload}.assinatura`;
}

const agoraSegundos = () => Math.floor(Date.now() / 1000);
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("accessExpirado (STC-611)", () => {
  it("vencido ou vencendo em segundos conta como expirado", async () => {
    const { accessExpirado } = await carregar();
    expect(accessExpirado(jwtComExp(agoraSegundos() - 60))).toBe(true);
    expect(accessExpirado(jwtComExp(agoraSegundos() + 5))).toBe(true);
    expect(accessExpirado(jwtComExp(agoraSegundos() + 3600))).toBe(false);
  });

  it("token ausente ou ilegível não conta como expirado", async () => {
    const { accessExpirado } = await carregar();
    expect(accessExpirado(undefined)).toBe(false);
    expect(accessExpirado("nao-e-jwt")).toBe(false);
  });
});

describe("tokenComAccessValido, usado pelo callback jwt (STC-611)", () => {
  it("access válido: devolve o token como veio, sem chamar o backend", async () => {
    const { tokenComAccessValido } = await carregar();
    const token = { backendAccessToken: jwtComExp(agoraSegundos() + 3600), backendRefreshToken: "r" };

    expect(await tokenComAccessValido(token)).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("access vencido: renova e devolve o par novo", async () => {
    const { tokenComAccessValido } = await carregar();
    fetchMock.mockResolvedValue(Response.json({ access: "access-novo", refresh: "refresh-novo" }));

    const token = await tokenComAccessValido({
      backendAccessToken: jwtComExp(agoraSegundos() - 60),
      backendRefreshToken: "refresh-antigo",
      outroCampo: "preservado",
    });

    expect(token).toEqual({
      backendAccessToken: "access-novo",
      backendRefreshToken: "refresh-novo",
      outroCampo: "preservado",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: "refresh-antigo" });
  });

  it("503 (renovação em andamento): espera o Retry-After e tenta de novo", async () => {
    vi.useFakeTimers();
    const { tokenComAccessValido } = await carregar();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(Response.json({ access: "a2", refresh: "r2" }));

    const promessa = tokenComAccessValido({
      backendAccessToken: jwtComExp(agoraSegundos() - 60),
      backendRefreshToken: "r1",
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await promessa).toEqual({ backendAccessToken: "a2", backendRefreshToken: "r2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renovação recusada: devolve o token como veio, sem lançar", async () => {
    const { tokenComAccessValido } = await carregar();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const token = { backendAccessToken: jwtComExp(agoraSegundos() - 60), backendRefreshToken: "r" };

    expect(await tokenComAccessValido(token)).toBe(token);
  });

  it("sem refresh no token: não chama o backend", async () => {
    const { tokenComAccessValido } = await carregar();
    const token = { backendAccessToken: jwtComExp(agoraSegundos() - 60) };

    expect(await tokenComAccessValido(token)).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("accessValidoPorMaisDe (STC-611)", () => {
  it("só confirma quando dá pra ler o exp e ele está além da folga", async () => {
    const { accessValidoPorMaisDe } = await carregar();
    expect(accessValidoPorMaisDe(jwtComExp(agoraSegundos() + 3600), 60)).toBe(true);
    expect(accessValidoPorMaisDe(jwtComExp(agoraSegundos() + 30), 60)).toBe(false);
    expect(accessValidoPorMaisDe(jwtComExp(agoraSegundos() - 60), 60)).toBe(false);
  });

  it("token ausente ou ilegível nunca conta como válido (na dúvida, renova)", async () => {
    const { accessValidoPorMaisDe } = await carregar();
    expect(accessValidoPorMaisDe(undefined, 60)).toBe(false);
    expect(accessValidoPorMaisDe("nao-e-jwt", 60)).toBe(false);
  });
});
