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
  it("bloqueia object-src e frame-src explicitamente", () => {
    const csp = construirCsp("qualquer");

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
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
