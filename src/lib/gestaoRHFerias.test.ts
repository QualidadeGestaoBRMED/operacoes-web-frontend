import { describe, expect, it } from "vitest";
import { avisoPrazoSubstituicao, subtrairDias } from "./gestaoRHFerias";

describe("prazo para acionar o RH", () => {
  it.each([
    ["2027-01-05", 40, "2026-11-26"],
    ["2026-03-10", 15, "2026-02-23"],
    ["2028-03-10", 15, "2028-02-24"],
    ["2026-11-23", 0, "2026-11-23"],
  ])("%s menos %i dias → %s", (inicio, dias, prazo) => {
    expect(subtrairDias(inicio, dias)).toBe(prazo);
  });

  it("aviso com a data e a antecedência, como no mockup", () => {
    expect(avisoPrazoSubstituicao("2027-01-05", 40, "2026-10-06")).toEqual({
      texto: "Acionar o RH até 26/11/2026 (40 dias antes do início das férias).",
      passou: false,
    });
  });

  it("um dia no singular e zero dias como o próprio início", () => {
    expect(avisoPrazoSubstituicao("2026-12-01", 1, "2026-10-06").texto).toBe(
      "Acionar o RH até 30/11/2026 (1 dia antes do início das férias).",
    );
    expect(avisoPrazoSubstituicao("2026-12-01", 0, "2026-10-06").texto).toBe(
      "Acionar o RH até 01/12/2026 (no dia do início das férias).",
    );
  });

  it("prazo hoje ainda não passou", () => {
    expect(avisoPrazoSubstituicao("2026-11-15", 40, "2026-10-06")).toEqual({
      texto: "Acionar o RH até hoje, 06/10/2026 (40 dias antes do início das férias).",
      passou: false,
    });
  });

  it("prazo antes de hoje: avisa que passou", () => {
    expect(avisoPrazoSubstituicao("2026-11-14", 40, "2026-10-06")).toEqual({
      texto:
        "O prazo para acionar o RH passou em 05/10/2026 (40 dias antes do início das férias). Acione o RH assim que registrar.",
      passou: true,
    });
  });
});
