import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ancora, TextoEmMarkdown } from "./TextoEmMarkdown";

const MARKDOWN = `Introdução.

## Horas por unidade

![Horas por unidade no gráfico](/novidades/horas.webp)

Texto da seção, com [o Painel](/modulos/gestao-rh).

### Melhorias

- **Gestão RH:** cards lado a lado no celular.
`;

describe("TextoEmMarkdown (STC-877, STC-878)", () => {
  it("na página da novidade: subtítulos com link próprio para a seção", () => {
    render(
      <TextoEmMarkdown markdown={MARKDOWN} prefixoDasAncoras="2026-10-23-01-horas" comLinksDasSecoes />,
    );

    const secao = screen.getByRole("heading", { level: 2, name: /Horas por unidade/ });
    expect(secao).toHaveAttribute("id", "2026-10-23-01-horas--horas-por-unidade");
    expect(screen.getByRole("link", { name: 'Link para "Horas por unidade"' })).toHaveAttribute(
      "href",
      "#2026-10-23-01-horas--horas-por-unidade",
    );
  });

  it("na lista: subtítulos sem o link da seção", () => {
    render(<TextoEmMarkdown markdown={MARKDOWN} prefixoDasAncoras="2026-10-23-01-horas" />);

    expect(screen.getByRole("heading", { level: 2, name: /Horas por unidade/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Link para/ })).not.toBeInTheDocument();
  });

  it("imagem da seção como mídia da novidade, com o texto alternativo e sem parágrafo em volta", () => {
    const { container } = render(<TextoEmMarkdown markdown={MARKDOWN} prefixoDasAncoras="x" />);

    const figura = container.querySelector("figure");
    expect(figura?.querySelector("img")).toHaveAttribute("src", "/novidades/horas.webp");
    expect(screen.getByRole("img", { name: "Horas por unidade no gráfico" })).toBeInTheDocument();
    expect(figura?.closest("p")).toBeNull();
  });

  it("link para tela do Atlas navega dentro do Atlas; área em negrito nas melhorias", () => {
    render(<TextoEmMarkdown markdown={MARKDOWN} prefixoDasAncoras="x" />);

    expect(screen.getByRole("link", { name: "o Painel" })).toHaveAttribute("href", "/modulos/gestao-rh");
    expect(screen.getByRole("link", { name: "o Painel" })).not.toHaveAttribute("target");
    expect(screen.getByText("Gestão RH:").tagName).toBe("STRONG");
  });

  it("endereço começando com // conta como externo", () => {
    render(<TextoEmMarkdown markdown="[fora](//exemplo.com)" prefixoDasAncoras="x" />);

    expect(screen.getByRole("link", { name: "fora" })).toHaveAttribute("target", "_blank");
  });

  it("subtítulos repetidos ou só com símbolos: links diferentes e nunca vazios", () => {
    render(
      <TextoEmMarkdown markdown={"## Melhorias\n\n## Melhorias\n\n## !!!"} prefixoDasAncoras="x" comLinksDasSecoes />,
    );

    expect(screen.getAllByRole("heading", { level: 2 }).map((titulo) => titulo.id)).toEqual([
      "x--melhorias",
      "x--melhorias-2",
      "x--secao",
    ]);
  });

  it("âncora sem acento e com hífens", () => {
    expect(ancora("Correções e Melhorias!")).toBe("correcoes-e-melhorias");
  });
});
