import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoParaQuemVeTudo } from "./SoParaQuemVeTudo";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
let alcance = "completo";
vi.mock("@/hooks/useModulosNavegacao", () => ({
  useAlcanceNoModulo: () => alcance,
  veSoOsProprios: (valor: string) => valor !== "completo",
}));

describe("SoParaQuemVeTudo (STC-976)", () => {
  beforeEach(() => {
    replace.mockReset();
    alcance = "completo";
  });

  it("com alcance completo, mostra a tela", () => {
    render(<SoParaQuemVeTudo>Mapa</SoParaQuemVeTudo>);

    expect(screen.getByText("Mapa")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["proprios", "responsavel"])("alcance %s: vai para a Lista", (valor) => {
    alcance = valor;
    render(<SoParaQuemVeTudo>Mapa</SoParaQuemVeTudo>);

    expect(screen.queryByText("Mapa")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/modulos/legalizacao");
  });
});
