import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToggleMapaLista } from "./ToggleMapaLista";

// Seletor de rede (STC-894): sem as duas redes, não aparece.
let redesAdministradas: string[] = [];
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ redesAdministradas }) }));

describe("ToggleMapaLista", () => {
  beforeEach(() => {
    redesAdministradas = [];
  });

  it("mostra o segmented control Mapa/Lista por padrão", () => {
    render(<ToggleMapaLista ativo="lista" />);

    expect(screen.getByRole("link", { name: "Mapa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lista" })).toBeInTheDocument();
  });

  // STC-451: Coordenação da Unidade só acompanha a própria unidade -- o
  // Mapa (panorama da rede inteira) não faz sentido pra esse perfil.
  it("esconde o Mapa quando mostrarMapa=false, sem virar link (só rótulo)", () => {
    render(<ToggleMapaLista ativo="lista" mostrarMapa={false} />);

    expect(screen.queryByRole("link", { name: "Mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lista" })).not.toBeInTheDocument();
    expect(screen.getByText("Lista")).toBeInTheDocument();
  });

  it("continua mostrando linkBiblioteca mesmo com o Mapa escondido", () => {
    render(<ToggleMapaLista ativo="lista" linkBiblioteca mostrarMapa={false} />);

    expect(screen.getByRole("link", { name: /Biblioteca de Documentos/i })).toBeInTheDocument();
  });

  // jsdom não avalia media query: as classes responsivas são o único jeito
  // de o teste ver o que some no celular.
  it("esconde o linkBiblioteca no celular: a Biblioteca já está nas abas do módulo", () => {
    render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

    const link = screen.getByRole("link", { name: /Biblioteca de Documentos/i });
    expect(link).toHaveClass("hidden", "sm:inline");
  });

  it("sem seletor de rede, a barra inteira some no celular", () => {
    const { container } = render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

    expect(container.firstElementChild).toHaveClass("hidden", "sm:flex");
  });

  it("com seletor de rede, a barra continua no celular", () => {
    redesAdministradas = ["padrao", "opex"];
    const { container } = render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

    expect(container.firstElementChild).toHaveClass("flex");
    expect(container.firstElementChild).not.toHaveClass("hidden");
    expect(screen.getByRole("combobox", { name: "Rede" })).toBeInTheDocument();
  });
});
