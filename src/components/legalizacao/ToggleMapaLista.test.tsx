import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToggleMapaLista } from "./ToggleMapaLista";

// Seletor de rede (STC-894): sem as duas redes, não aparece.
let redesAdministradas: string[] = [];
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ redesAdministradas }) }));
let alcance = "completo";
vi.mock("@/hooks/useModulosNavegacao", () => ({
  useAlcanceNoModulo: () => alcance,
  veSoOsProprios: (valor: string) => valor !== "completo",
}));

describe("ToggleMapaLista", () => {
  beforeEach(() => {
    redesAdministradas = [];
    alcance = "completo";
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
  // Mesmo corte do QUERY_MOBILE (767px), em que as abas do módulo aparecem:
  // com `sm`, de 640 a 767px o link e a aba Biblioteca apareceriam juntos.
  it("esconde o linkBiblioteca enquanto há abas do módulo (abaixo de md)", () => {
    render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

    const link = screen.getByRole("link", { name: /Biblioteca de Documentos/i });
    expect(link).toHaveClass("hidden", "md:inline");
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

  describe("quem vê só os próprios documentos (STC-976)", () => {
    it.each(["proprios", "responsavel"])("alcance %s: sem Mapa, Biblioteca nem Exportar", (valor) => {
      alcance = valor;
      render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

      expect(screen.queryByRole("link", { name: "Mapa" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Biblioteca de Documentos/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Exportar situação/i })).not.toBeInTheDocument();
    });

    it("alcance completo mantém Mapa, Biblioteca e Exportar", () => {
      render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

      expect(screen.getByRole("link", { name: "Mapa" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Biblioteca de Documentos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Exportar situação/i })).toBeInTheDocument();
    });
  });
});
