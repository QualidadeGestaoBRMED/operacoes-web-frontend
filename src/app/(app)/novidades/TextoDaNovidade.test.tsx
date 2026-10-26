import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ancora, TextoDaNovidade } from "./TextoDaNovidade";

vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: () => ({ modulos: [] }) }));

const MARKDOWN = `Introdução.

## Horas por unidade

![](/novidades/horas.webp)

Texto da seção, com [o Painel](/modulos/gestao-rh).

### Melhorias

- **Gestão RH:** cards lado a lado no celular.
`;

describe("TextoDaNovidade (STC-877)", () => {
  it("subtítulos com link próprio para a seção", () => {
    render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="2026-10-23-01-horas" />);

    const secao = screen.getByRole("heading", { level: 2, name: /Horas por unidade/ });
    expect(secao).toHaveAttribute("id", "2026-10-23-01-horas--horas-por-unidade");
    expect(screen.getByRole("link", { name: 'Link para "Horas por unidade"' })).toHaveAttribute(
      "href",
      "/novidades/2026-10-23-01-horas#2026-10-23-01-horas--horas-por-unidade",
    );
  });

  it("imagem da seção como mídia da novidade, sem parágrafo em volta", () => {
    const { container } = render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="x" />);

    const figura = container.querySelector("figure");
    expect(figura?.querySelector("img")).toHaveAttribute("src", "/novidades/horas.webp");
    expect(figura?.closest("p")).toBeNull();
  });

  it("link para tela do Atlas navega dentro do Atlas; área em negrito nas melhorias", () => {
    render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="x" />);

    expect(screen.getByRole("link", { name: "o Painel" })).toHaveAttribute("href", "/modulos/gestao-rh");
    expect(screen.getByRole("link", { name: "o Painel" })).not.toHaveAttribute("target");
    expect(screen.getByText("Gestão RH:").tagName).toBe("STRONG");
  });

  it("âncora sem acento e com hífens", () => {
    expect(ancora("Correções e Melhorias!")).toBe("correcoes-e-melhorias");
  });
});
