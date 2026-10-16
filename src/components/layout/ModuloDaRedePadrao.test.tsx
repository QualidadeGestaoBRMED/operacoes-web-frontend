import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import type { Rede } from "@/types";
import { ModuloDaRedePadrao } from "./ModuloDaRedePadrao";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function comRedes(redes: Rede[]) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAdminOps: redes.length > 0,
    administraRedePadrao: redes.includes("padrao"),
  } as ReturnType<typeof useAuth>);
}

function renderModulo() {
  render(
    <ModuloDaRedePadrao>
      <p>Conteúdo do módulo</p>
    </ModuloDaRedePadrao>,
  );
}

beforeEach(() => replace.mockClear());

describe("ModuloDaRedePadrao (STC-747)", () => {
  it("Admin Operações Especiais volta para o Kanban sem ver o módulo", () => {
    comRedes(["opex"]);
    renderModulo();

    expect(screen.queryByText("Conteúdo do módulo")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/modulos/gestao-demandas");
  });

  it("enquanto a sessão carrega, o módulo não monta", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: true,
      isAdminOps: false,
      administraRedePadrao: false,
    } as ReturnType<typeof useAuth>);
    renderModulo();

    expect(screen.queryByText("Conteúdo do módulo")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each<[string, Rede[]]>([
    ["Gestão de Operações", ["opex", "padrao"]],
    ["Admin Operações", ["padrao"]],
    ["quem não é Admin", []],
  ])("%s vê o módulo", (_cargo, redes) => {
    comRedes(redes);
    renderModulo();

    expect(screen.getByText("Conteúdo do módulo")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
