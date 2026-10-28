import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { SeletorRedeLegalizacao } from "./SeletorRedeLegalizacao";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

const CHAVE = "atlas.legalizacao.rede";

function comoCargo(cargo: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    redesAdministradas: [],
    isSetorLeg: false,
    isPontoFocal: false,
    ...cargo,
  } as never);
}

// Mostra a rede que as telas usam, ao lado do seletor.
function Tela() {
  const { rede } = useRedeDaLegalizacao();
  return (
    <>
      <SeletorRedeLegalizacao />
      <p data-testid="rede">{rede}</p>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});

describe("SeletorRedeLegalizacao (STC-894)", () => {
  it("quem vê as duas redes escolhe, e a escolha fica guardada", async () => {
    comoCargo({ isSetorLeg: true });
    const user = userEvent.setup();
    render(<Tela />);

    expect(screen.getByTestId("rede")).toHaveTextContent("padrao");
    expect(screen.getByLabelText("Rede")).toHaveTextContent("Rede própria");
    await user.click(screen.getByLabelText("Rede"));
    await user.click(screen.getByRole("option", { name: "Operações Especiais" }));

    expect(screen.getByTestId("rede")).toHaveTextContent("opex");
    expect(window.localStorage.getItem(CHAVE)).toBe("opex");
  });

  it("a escolha guardada vale ao abrir outra tela", () => {
    window.localStorage.setItem(CHAVE, "opex");
    comoCargo({ redesAdministradas: ["opex", "padrao"] });
    render(<Tela />);

    expect(screen.getByTestId("rede")).toHaveTextContent("opex");
  });

  it.each([
    ["Ponto focal", { isPontoFocal: true }, "opex"],
    ["Admin Operações Especiais", { redesAdministradas: ["opex"] as const }, "opex"],
    ["Coordenador", {}, "padrao"],
  ])("%s fica na sua rede, sem seletor", (_, cargo, rede) => {
    comoCargo(cargo as never);
    render(<Tela />);

    expect(screen.queryByLabelText("Rede")).not.toBeInTheDocument();
    expect(screen.getByTestId("rede")).toHaveTextContent(rede);
  });

  it("escolha guardada de outra rede (outro login no navegador) não vale", () => {
    window.localStorage.setItem(CHAVE, "padrao");
    comoCargo({ isPontoFocal: true });
    render(<Tela />);

    expect(screen.getByTestId("rede")).toHaveTextContent("opex");
  });
});
