import { describe, expect, it } from "vitest";
import type { PainelHorasExtras } from "@/types/gestaoRH";
import { formatarHoras, formatarHorasDoEixo, rotuloDoFator } from "./gestaoRHHorasExtras";

describe("formatarHoras", () => {
  it.each([
    [0, "0:00:00"],
    [5875, "97:55:00"],
    [45, "0:45:00"],
    [120, "2:00:00"],
    [1490, "24:50:00"],
    [25610, "426:50:00"],
    [60000, "1.000:00:00"],
    [81352, "1.355:52:00"],
  ])("%i minutos → %s", (minutos, esperado) => {
    expect(formatarHoras(minutos)).toBe(esperado);
  });
});

describe("formatarHorasDoEixo", () => {
  it("horas inteiras com ponto de milhar", () => {
    expect(formatarHorasDoEixo(150)).toBe("150h");
    expect(formatarHorasDoEixo(1500)).toBe("1.500h");
  });
});

describe("rotuloDoFator", () => {
  function painel(percentual: string | null) {
    return { fatores: [{ fator: "1", percentual }] } as PainelHorasExtras;
  }

  it("usa o percentual lido do VR", () => {
    expect(rotuloDoFator("1", painel("50"))).toBe("50%");
    expect(rotuloDoFator("1", painel("62.5"))).toBe("62,5%");
  });

  it("sem percentual (ou sem painel), o número do fator", () => {
    expect(rotuloDoFator("1", painel(null))).toBe("Fator 1");
    expect(rotuloDoFator("2", undefined)).toBe("Fator 2");
  });
});
