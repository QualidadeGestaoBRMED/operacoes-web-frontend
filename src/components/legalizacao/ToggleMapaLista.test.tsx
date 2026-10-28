import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToggleMapaLista } from "./ToggleMapaLista";

// Seletor de rede (STC-894): sem as duas redes, não aparece.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ redesAdministradas: [] }) }));

describe("ToggleMapaLista", () => {
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

  // Achado no dogfooding: linkBiblioteca (STC-416/441) e o container ao
  // redor tinham "hidden sm:*" -- Biblioteca de Documentos ficava
  // invisível no mobile, sem nenhuma outra forma de navegação até lá
  // (sidebar hoje é 1 link por módulo, sem submenu). jsdom não avalia
  // media query nenhuma, então um teste checando só "está no documento"
  // (como os de cima) não pegava essa classe escondendo no mobile -- só
  // checar a classList explicitamente detecta a regressão.
  it("linkBiblioteca fica visível também no mobile (sem classe hidden)", () => {
    render(<ToggleMapaLista ativo="lista" linkBiblioteca />);

    const link = screen.getByRole("link", { name: /Biblioteca de Documentos/i });
    expect(link.className).not.toMatch(/\bhidden\b/);
    expect(link.closest("div")?.className).not.toMatch(/\bhidden\b/);
  });
});
