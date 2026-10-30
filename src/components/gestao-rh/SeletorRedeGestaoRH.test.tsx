import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDoGestaoRH } from "@/hooks/useRedeDoGestaoRH";
import { SeletorRedeGestaoRH } from "./SeletorRedeGestaoRH";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

const CHAVE = "atlas.gestao-rh.rede";

function comoCargo(cargo: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    redesAdministradas: [],
    isPontoFocal: false,
    ...cargo,
  } as never);
}

// Mostra a rede que as telas usam, ao lado do seletor.
function Tela() {
  const { rede } = useRedeDoGestaoRH();
  return (
    <>
      <SeletorRedeGestaoRH />
      <p data-testid="rede">{rede}</p>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});

describe("SeletorRedeGestaoRH (STC-907)", () => {
  it("quem administra as duas redes escolhe, e a escolha fica guardada", async () => {
    comoCargo({ redesAdministradas: ["opex", "padrao"] });
    const user = userEvent.setup();
    render(<Tela />);

    expect(screen.getByTestId("rede")).toHaveTextContent("padrao");
    await user.click(screen.getByLabelText("Rede"));
    await user.click(screen.getByRole("option", { name: "Operações Especiais" }));

    expect(screen.getByTestId("rede")).toHaveTextContent("opex");
    expect(window.localStorage.getItem(CHAVE)).toBe("opex");
  });

  it("a escolha não se mistura com a da Legalização", () => {
    window.localStorage.setItem("atlas.legalizacao.rede", "opex");
    comoCargo({ redesAdministradas: ["opex", "padrao"] });
    render(<Tela />);

    expect(screen.getByTestId("rede")).toHaveTextContent("padrao");
  });

  it.each([
    ["Admin Operações", { redesAdministradas: ["padrao"] as const }, "padrao"],
    ["Admin Operações Especiais", { redesAdministradas: ["opex"] as const }, "opex"],
    ["Ponto focal", { isPontoFocal: true }, "opex"],
    ["Coordenação", {}, "padrao"],
  ])("%s fica na sua rede, sem seletor", (_, cargo, rede) => {
    // Escolha guardada de outro login no mesmo navegador não vale.
    window.localStorage.setItem(CHAVE, rede === "opex" ? "padrao" : "opex");
    comoCargo(cargo as Partial<ReturnType<typeof useAuth>>);
    render(<Tela />);

    expect(screen.queryByLabelText("Rede")).not.toBeInTheDocument();
    expect(screen.getByTestId("rede")).toHaveTextContent(rede);
  });
});
