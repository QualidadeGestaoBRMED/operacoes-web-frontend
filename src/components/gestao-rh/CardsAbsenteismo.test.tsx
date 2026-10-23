import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { painelAbsenteismoDeExemplo } from "@/test-utils/painelAbsenteismoExemplo";
import { CardsAbsenteismo } from "./CardsAbsenteismo";

const FILTROS = { inicio: "2026-09-01", fim: "2026-09-30" };

// STC-791/873: o jsdom não calcula a grade; o teste confere as classes que
// a montam. No celular (2 colunas) todos os cards vêm em pares, inclusive
// Absenteísmo e Horas perdidas; nenhum ocupa a linha toda.
function card(rotulo: string) {
  return screen.getByText(rotulo).closest("button, div[class*='rounded-xl']") as HTMLElement;
}

describe("CardsAbsenteismo, grade sem buraco (STC-791/873)", () => {
  it("com faixas: os dois principais lado a lado no celular, 6 colunas só em tela bem larga", () => {
    const { container } = render(<CardsAbsenteismo painel={painelAbsenteismoDeExemplo(FILTROS)} />);

    for (const rotulo of ["Absenteísmo", "Horas perdidas", "Faixa crítica"]) {
      expect(card(rotulo).className).not.toMatch(/col-span/);
    }
    expect(container.firstChild).toHaveClass("grid-cols-2", "sm:grid-cols-3", "2xl:grid-cols-6");
  });

  it("sem faixas: 4 cards numa linha a partir do tablet", () => {
    const painel = painelAbsenteismoDeExemplo(FILTROS);
    const { container } = render(
      <CardsAbsenteismo
        painel={{ ...painel, parametros: { ...painel.parametros, faixas_cadastradas: false } }}
      />,
    );

    expect(screen.queryByText("Faixa crítica")).not.toBeInTheDocument();
    expect(card("Absenteísmo").className).not.toMatch(/col-span/);
    expect(container.firstChild).toHaveClass("grid-cols-2", "sm:grid-cols-4");
  });

  it("carregando: seis esqueletos em pares, como os cards", () => {
    const { container } = render(<CardsAbsenteismo painel={undefined} />);

    const esqueletos = container.querySelectorAll("[data-slot='skeleton']");
    expect(esqueletos).toHaveLength(6);
    for (const esqueleto of esqueletos) {
      expect(esqueleto.className).not.toMatch(/col-span/);
    }
  });
});

describe("CardsAbsenteismo, horas perdidas (STC-849)", () => {
  function painelCom(cards: Record<string, unknown>) {
    const painel = painelAbsenteismoDeExemplo(FILTROS);
    return { ...painel, cards: { ...painel.cards, ...cards } };
  }

  it("mostra as horas no formato do VR, com a dica do que entra", () => {
    render(<CardsAbsenteismo painel={painelCom({ minutos_ausentes: 5875 })} />);

    expect(screen.getByText("97:55:00")).toBeInTheDocument();
    expect(card("Horas perdidas")).toHaveAttribute(
      "title",
      expect.stringContaining("não valor em reais"),
    );
  });

  it("compara com o período anterior, mais horas em vermelho", () => {
    render(
      <CardsAbsenteismo
        painel={painelCom({ minutos_ausentes: 600 })}
        comparativo={{ pontos: 1, nomeAnterior: "agosto", parcial: false, minutosAnteriores: 510 }}
      />,
    );

    const variacao = screen.getByText("▲ +1:30:00 vs. agosto");
    expect(variacao).toHaveClass("text-red-600");
  });

  it("sem horas previstas no período, mostra traço em vez de zero", () => {
    render(
      <CardsAbsenteismo painel={painelCom({ percentual_periodo: null, minutos_ausentes: 0 })} />,
    );

    expect(card("Horas perdidas")).toHaveTextContent("—");
    expect(screen.queryByText("0:00:00")).not.toBeInTheDocument();
  });
});
