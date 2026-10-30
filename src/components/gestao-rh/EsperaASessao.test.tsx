import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { EsperaASessao } from "./EsperaASessao";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

describe("EsperaASessao (STC-907)", () => {
  it("não monta as telas enquanto a sessão (e a rede de quem entra) carrega", () => {
    vi.mocked(useAuth).mockReturnValue({ isLoading: true } as ReturnType<typeof useAuth>);
    const { rerender } = render(
      <EsperaASessao>
        <p>Painel</p>
      </EsperaASessao>,
    );
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
    // Esqueleto no lugar da área em branco.
    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument();

    vi.mocked(useAuth).mockReturnValue({ isLoading: false } as ReturnType<typeof useAuth>);
    rerender(
      <EsperaASessao>
        <p>Painel</p>
      </EsperaASessao>,
    );
    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Carregando" })).not.toBeInTheDocument();
  });
});
