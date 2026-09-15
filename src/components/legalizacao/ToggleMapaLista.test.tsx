import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToggleMapaLista } from "./ToggleMapaLista";

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
});
