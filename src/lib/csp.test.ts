import { describe, expect, it } from "vitest";
import { construirCsp, gerarNonce } from "./csp";

describe("construirCsp", () => {
  it("usa o nonce recebido em script-src, sem 'unsafe-inline' nele", () => {
    const csp = construirCsp("nonce-de-teste");

    expect(csp).toContain("script-src 'self' 'nonce-nonce-de-teste'");
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  // Achado no code review do Tech Lead (STC-239): baseline de CSP que
  // faltava -- fecha superfície de conteúdo plugin/embeddable legado, e
  // evita frame-src herdar de default-src implicitamente.
  it("bloqueia object-src explicitamente", () => {
    const csp = construirCsp("qualquer");

    expect(csp).toContain("object-src 'none'");
  });

  // frame-src abriu pra blob: (STC-416): o preview de PDF da Biblioteca de
  // Documentos embeda um <iframe src="blob:...">montado no client a partir
  // de bytes já buscados via /api/media (proxy same-origin) -- nunca outra
  // origem de verdade, frame-ancestors continua 'none'.
  it("permite frame-src só de 'self' e blob:, nunca outra origem", () => {
    const csp = construirCsp("qualquer");

    expect(csp).toContain("frame-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("mantém style-src com 'unsafe-inline' (decisão documentada, style={{}} dinâmico)", () => {
    const csp = construirCsp("qualquer");

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});

describe("gerarNonce", () => {
  it("gera valores diferentes a cada chamada", () => {
    expect(gerarNonce()).not.toBe(gerarNonce());
  });
});
