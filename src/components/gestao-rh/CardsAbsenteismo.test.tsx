import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { painelAbsenteismoDeExemplo } from "@/test-utils/painelAbsenteismoExemplo";
import { CardsAbsenteismo } from "./CardsAbsenteismo";

const FILTROS = { inicio: "2026-09-01", fim: "2026-09-30" };

// STC-791: o jsdom não calcula a grade; o teste confere as classes que a
// montam. No celular (2 colunas) o Absenteísmo ocupa a largura toda, e no
// tablet (3 colunas) só quando são 5 cards.
function cardDeAbsenteismo() {
  return screen.getByText("Absenteísmo").closest("button, div[class*='rounded-xl']") as HTMLElement;
}

describe("CardsAbsenteismo, grade sem buraco (STC-791)", () => {
  it("com faixas: 2 colunas no celular e no tablet, 1 no computador", () => {
    render(<CardsAbsenteismo painel={painelAbsenteismoDeExemplo(FILTROS)} />);

    expect(cardDeAbsenteismo()).toHaveClass("col-span-2", "xl:col-span-1");
    expect(cardDeAbsenteismo()).not.toHaveClass("sm:col-span-1");
  });

  it("sem faixas: 2 colunas só no celular (os 3 cards fecham a linha do tablet)", () => {
    const painel = painelAbsenteismoDeExemplo(FILTROS);
    render(
      <CardsAbsenteismo
        painel={{ ...painel, parametros: { ...painel.parametros, faixas_cadastradas: false } }}
      />,
    );

    expect(screen.queryByText("Faixa crítica")).not.toBeInTheDocument();
    expect(cardDeAbsenteismo()).toHaveClass("col-span-2", "sm:col-span-1");
  });

  it("carregando: o primeiro esqueleto ocupa o lugar do Absenteísmo", () => {
    const { container } = render(<CardsAbsenteismo painel={undefined} />);

    const esqueletos = container.querySelectorAll("[data-slot='skeleton']");
    expect(esqueletos).toHaveLength(5);
    expect(esqueletos[0]).toHaveClass("col-span-2", "xl:col-span-1");
    expect(esqueletos[1]).not.toHaveClass("col-span-2");
  });
});
