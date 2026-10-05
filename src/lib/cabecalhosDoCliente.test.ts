import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";

import { cabecalhosDaRequisicaoAtual, cabecalhosDoCliente } from "./cabecalhosDoCliente";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

describe("cabecalhosDoCliente (STC-637)", () => {
  it("repassa o primeiro IP do x-forwarded-for e o navegador", () => {
    const entrada = new Headers({
      "x-forwarded-for": "200.10.20.30, 76.76.21.21",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
    });

    expect(cabecalhosDoCliente(entrada)).toEqual({
      "X-Forwarded-For": "200.10.20.30",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
    });
  });

  it("aceita IPv6", () => {
    const entrada = new Headers({ "x-forwarded-for": "2804:14c:5b:8000::1" });

    expect(cabecalhosDoCliente(entrada)).toEqual({ "X-Forwarded-For": "2804:14c:5b:8000::1" });
  });

  it("sem x-forwarded-for (dev), não inventa um IP", () => {
    expect(cabecalhosDoCliente(new Headers({ "user-agent": "curl/8" }))).toEqual({
      "User-Agent": "curl/8",
    });
    expect(cabecalhosDoCliente(new Headers())).toEqual({});
  });

  it.each(["unknown", "<script>", "1.2.3.4; injecao", "a".repeat(60)])(
    "valor que não parece IP não é repassado (%s)",
    (valor) => {
      expect(cabecalhosDoCliente(new Headers({ "x-forwarded-for": valor }))).toEqual({});
    },
  );

  it("corta o navegador no tamanho que o backend guarda", () => {
    const entrada = new Headers({ "user-agent": "x".repeat(500) });

    expect(cabecalhosDoCliente(entrada)["User-Agent"]).toHaveLength(300);
  });
});

describe("cabecalhosDaRequisicaoAtual", () => {
  it("lê da requisição em andamento", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-forwarded-for": "200.10.20.30", "user-agent": "Firefox" }) as never,
    );

    expect(await cabecalhosDaRequisicaoAtual()).toEqual({
      "X-Forwarded-For": "200.10.20.30",
      "User-Agent": "Firefox",
    });
  });

  it("fora de uma requisição (ex.: middleware), não repassa nada nem quebra", async () => {
    vi.mocked(headers).mockRejectedValue(new Error("headers() fora de uma requisição"));

    expect(await cabecalhosDaRequisicaoAtual()).toEqual({});
  });
});
