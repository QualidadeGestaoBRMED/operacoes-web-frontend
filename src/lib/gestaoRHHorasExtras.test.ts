import { describe, expect, it } from "vitest";
import type { PainelHorasExtras } from "@/types/gestaoRH";
import { formatarHoras, rotuloDoFator } from "./gestaoRHHorasExtras";

describe("formatarHoras", () => {
  it.each([
    [0, "0h"],
    [45, "0h45"],
    [120, "2h"],
    [1490, "24h50"],
    [25610, "426h50"],
  ])("%i minutos → %s", (minutos, esperado) => {
    expect(formatarHoras(minutos)).toBe(esperado);
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
