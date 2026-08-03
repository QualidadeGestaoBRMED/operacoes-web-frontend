import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { autorizado } from "./auth";

// Achado no code review do Tech Lead (STC-239): script-src usava
// 'unsafe-inline' -- migrado pra nonce, gerado dentro de authorized()
// (extraído como autorizado() só pra dar pra testar isolado, sem montar
// toda a infraestrutura de middleware). Estes testes cobrem as duas coisas
// juntas -- a árvore de decisão de autorização não pode ter mudado, e a
// resposta "permitida" precisa carregar CSP com nonce de verdade.
function requisicao(path: string, opcoes: { cookie?: string } = {}) {
  return new NextRequest(`https://atlas.exemplo.com.br${path}`, {
    headers: opcoes.cookie ? { cookie: opcoes.cookie } : undefined,
  });
}

describe("autorizado", () => {
  it("bloqueia rota protegida sem sessão", () => {
    const resultado = autorizado({
      auth: null,
      request: requisicao("/modulos/gestao-demandas"),
    });

    expect(resultado).toBe(false);
  });

  it("bloqueia rota protegida com sessão sem usuarioId confirmado pelo backend", () => {
    const resultado = autorizado({
      auth: { user: {}, expires: "" } as never,
      request: requisicao("/modulos/gestao-demandas"),
    });

    expect(resultado).toBe(false);
  });

  it("permite rota protegida com usuarioId, devolvendo CSP com nonce", () => {
    const resultado = autorizado({
      auth: { user: { usuarioId: 1 }, expires: "" } as never,
      request: requisicao("/modulos/gestao-demandas"),
    });

    expect(resultado).not.toBe(false);
    expect(resultado).not.toBe(true);
    const resposta = resultado as Response;
    const csp = resposta.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    // Sem 'unsafe-inline' em script-src -- só style-src continua com ele
    // (motivo documentado em src/lib/csp.ts).
    const scriptSrc = csp!.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("permite /login mesmo sem sessão, devolvendo CSP com nonce", () => {
    const resultado = autorizado({ auth: null, request: requisicao("/login") });

    expect(resultado).not.toBe(false);
    expect(resultado).not.toBe(true);
    const csp = (resultado as Response).headers.get("Content-Security-Policy");
    expect(csp).toMatch(/script-src 'self' 'nonce-/);
  });

  it("gera um nonce diferente a cada chamada", () => {
    const respostaA = autorizado({
      auth: { user: { usuarioId: 1 }, expires: "" } as never,
      request: requisicao("/modulos/gestao-demandas"),
    }) as Response;
    const respostaB = autorizado({
      auth: { user: { usuarioId: 1 }, expires: "" } as never,
      request: requisicao("/modulos/gestao-demandas"),
    }) as Response;

    expect(respostaA.headers.get("Content-Security-Policy")).not.toBe(
      respostaB.headers.get("Content-Security-Policy"),
    );
  });

  it("redireciona pro login com erro e limpa o cookie de sessão quando o backend falhou", () => {
    const resultado = autorizado({
      auth: { error: "BackendAuthError", user: {}, expires: "" } as never,
      request: requisicao("/modulos/gestao-demandas", {
        cookie: "authjs.session-token=algum-valor",
      }),
    });

    const resposta = resultado as Response;
    expect(resposta.status).toBe(307);
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("error")).toBe("BackendAuthError");
    expect(resposta.headers.get("set-cookie")).toContain("authjs.session-token=;");
  });
});
