import { describe, expect, it } from "vitest";
import { normalizarIdentificador, usaIdentificador } from "./identificadorDocumento";

describe("normalizarIdentificador", () => {
  it("põe em maiúsculas e normaliza os espaços como o backend", () => {
    expect(normalizarIdentificador("  Aso 1   Fulano ")).toBe("ASO 1 FULANO");
    expect(normalizarIdentificador("balança\t02")).toBe("BALANÇA 02");
    expect(normalizarIdentificador("   ")).toBe("");
  });
});

describe("usaIdentificador", () => {
  it("vale para tipo controlado por profissional ou com múltiplas instâncias", () => {
    expect(usaIdentificador({ controlado_por_profissional: true })).toBe(true);
    expect(usaIdentificador({ permite_multiplas_instancias: true })).toBe(true);
    expect(usaIdentificador({})).toBe(false);
  });
});
