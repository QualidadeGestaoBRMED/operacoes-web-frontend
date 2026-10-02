import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("construirCsp com o bucket do R2 (STC-628)", () => {
  const BUCKET = "https://conta123.r2.cloudflarestorage.com/atlas-anexos/";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function diretiva(csp: string, nome: string) {
    return csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${nome} `));
  }

  it("libera só o caminho do bucket em connect-src e frame-src", () => {
    vi.stubEnv("R2_URL_BUCKET", BUCKET);

    const csp = construirCsp("qualquer");

    expect(diretiva(csp, "connect-src")).toBe(`connect-src 'self' ${BUCKET}`);
    expect(diretiva(csp, "frame-src")).toBe(`frame-src 'self' blob: ${BUCKET}`);
    // Nada além dessas duas: imagem, script e frame-ancestors não mudam.
    expect(diretiva(csp, "img-src")).not.toContain("r2.cloudflarestorage.com");
    expect(diretiva(csp, "script-src")).not.toContain("r2.cloudflarestorage.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sem a variável, não libera nada além de 'self'", () => {
    vi.stubEnv("R2_URL_BUCKET", "");

    const csp = construirCsp("qualquer");

    expect(diretiva(csp, "connect-src")).toBe("connect-src 'self'");
    expect(diretiva(csp, "frame-src")).toBe("frame-src 'self' blob:");
  });

  it.each([
    ["só o domínio, sem o bucket", "https://conta123.r2.cloudflarestorage.com"],
    ["curinga de conta", "https://*.r2.cloudflarestorage.com/atlas-anexos/"],
    ["outro domínio", "https://atacante.example.com/atlas-anexos/"],
    ["http", "http://conta123.r2.cloudflarestorage.com/atlas-anexos/"],
    ["injeção de diretiva", `${BUCKET}; script-src *`],
  ])("ignora valor fora do formato (%s)", (_caso, valor) => {
    vi.stubEnv("R2_URL_BUCKET", valor);

    const csp = construirCsp("qualquer");

    expect(diretiva(csp, "connect-src")).toBe("connect-src 'self'");
    expect(csp).not.toContain("script-src *");
  });
});

describe("gerarNonce", () => {
  it("gera valores diferentes a cada chamada", () => {
    expect(gerarNonce()).not.toBe(gerarNonce());
  });
});
