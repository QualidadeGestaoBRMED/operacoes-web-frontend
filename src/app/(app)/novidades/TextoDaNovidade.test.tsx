import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ancora, TextoDaNovidade } from "./TextoDaNovidade";

vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: () => ({ modulos: [] }) }));

const MARKDOWN = `Introdução.

## Horas por unidade

![Horas por unidade no gráfico](/novidades/horas.webp)

Texto da seção, com [o Painel](/modulos/gestao-rh).

### Melhorias

- **Gestão RH:** cards lado a lado no celular.
`;

describe("TextoDaNovidade (STC-877)", () => {
  it("na página da novidade: subtítulos com link próprio para a seção", () => {
    render(
      <TextoDaNovidade markdown={MARKDOWN} idDaNovidade="2026-10-23-01-horas" comLinksDasSecoes />,
    );

    const secao = screen.getByRole("heading", { level: 2, name: /Horas por unidade/ });
    expect(secao).toHaveAttribute("id", "2026-10-23-01-horas--horas-por-unidade");
    expect(screen.getByRole("link", { name: 'Link para "Horas por unidade"' })).toHaveAttribute(
      "href",
      "#2026-10-23-01-horas--horas-por-unidade",
    );
  });

  it("na lista: subtítulos sem o link da seção", () => {
    render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="2026-10-23-01-horas" />);

    expect(screen.getByRole("heading", { level: 2, name: /Horas por unidade/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Link para/ })).not.toBeInTheDocument();
  });

  it("imagem da seção como mídia da novidade, com o texto alternativo e sem parágrafo em volta", () => {
    const { container } = render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="x" />);

    const figura = container.querySelector("figure");
    expect(figura?.querySelector("img")).toHaveAttribute("src", "/novidades/horas.webp");
    expect(screen.getByRole("img", { name: "Horas por unidade no gráfico" })).toBeInTheDocument();
    expect(figura?.closest("p")).toBeNull();
  });

  it("link para tela do Atlas navega dentro do Atlas; área em negrito nas melhorias", () => {
    render(<TextoDaNovidade markdown={MARKDOWN} idDaNovidade="x" />);

    expect(screen.getByRole("link", { name: "o Painel" })).toHaveAttribute("href", "/modulos/gestao-rh");
    expect(screen.getByRole("link", { name: "o Painel" })).not.toHaveAttribute("target");
    expect(screen.getByText("Gestão RH:").tagName).toBe("STRONG");
  });

  it("endereço começando com // conta como externo", () => {
    render(<TextoDaNovidade markdown="[fora](//exemplo.com)" idDaNovidade="x" />);

    expect(screen.getByRole("link", { name: "fora" })).toHaveAttribute("target", "_blank");
  });

  it("subtítulos repetidos ou só com símbolos: links diferentes e nunca vazios", () => {
    render(
      <TextoDaNovidade markdown={"## Melhorias\n\n## Melhorias\n\n## !!!"} idDaNovidade="x" comLinksDasSecoes />,
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
