import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import { DemandaCard } from "./DemandaCard";

describe("DemandaCard -- avatar e nome do responsável principal", () => {
  it("mostra as iniciais e o nome quando o responsável não tem foto", () => {
    const demanda = criarDemanda({ responsaveis: [responsavelPrincipal()] });
    const { container } = render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    expect(screen.getByText("RU")).toBeInTheDocument();
    expect(screen.getByText("Responsável Um")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("mostra a foto do Google e o nome quando o responsável tem foto_url", () => {
    const responsavel = responsavelPrincipal();
    responsavel.usuario.foto_url = "https://lh3.googleusercontent.com/a/foto-responsavel";
    const demanda = criarDemanda({ responsaveis: [responsavel] });
    const { container } = render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    // alt="" (decorativo) tira a imagem do role "img" -- busca direto no DOM.
    const imagem = container.querySelector("img");
    expect(imagem).toHaveAttribute("src", responsavel.usuario.foto_url);
    expect(imagem).toHaveAttribute("referrerPolicy", "no-referrer");
    expect(screen.getByText("Responsável Um")).toBeInTheDocument();
    expect(screen.queryByText("RU")).not.toBeInTheDocument();
  });

  it("mostra '—' e nenhum nome quando não há responsável principal", () => {
    const demanda = criarDemanda({ responsaveis: [] });
    const { container } = render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Responsável Um")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});

describe("DemandaCard -- badges de área responsável", () => {
  // STC-392: pedido no dogfooding -- cada área vira o próprio badge (igual
  // etiquetas), não um badge só com o texto concatenado "Gerência,
  // Processo". Sem cap "+N" aqui (diferente de etiquetas): área responsável
  // é catálogo fixo de 4 valores, não uma lista livre sem limite.
  it("mostra uma badge separada por área, não texto concatenado", () => {
    const demanda = criarDemanda({
      unidade: null,
      area_responsavel: ["gerencia", "processo"],
    });
    render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    expect(screen.getByText("Gerência")).toBeInTheDocument();
    expect(screen.getByText("Processo")).toBeInTheDocument();
    expect(screen.queryByText("Gerência, Processo")).not.toBeInTheDocument();
  });

  // STC-392: achado no code review -- rotuloUnidadeOuResponsavel (fonte do
  // aria-label) chegou a condensar em "N áreas" a partir de 3, então um
  // leitor de tela anunciava só a contagem enquanto os badges visíveis (o
  // teste acima) mostravam os nomes completos. aria-label sempre precisa
  // ter os nomes por extenso, não só a contagem.
  it("aria-label nomeia todas as áreas responsáveis, mesmo com 3 ou mais", () => {
    const demanda = criarDemanda({
      unidade: null,
      area_responsavel: ["gerencia", "processo", "qualidade"],
    });
    render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    const card = screen.getByRole("button");
    expect(card).toHaveAccessibleName(/Gerência, Processo, Qualidade/);
  });

  it("mostra a unidade quando não há área responsável", () => {
    const demanda = criarDemanda({
      unidade: {
        id: 1,
        nome: "Niterói",
        codigo: "NIT",
        cidade: "Niterói",
        ativa: true,
        rede: "padrao",
      },
      area_responsavel: [],
    });
    render(<DemandaCard demanda={demanda} onClick={vi.fn()} />);

    expect(screen.getByText("Niterói")).toBeInTheDocument();
  });
});

describe("DemandaCard em ver como (STC-790)", () => {
  afterEach(() => sessionStorage.clear());

  function arrastavel(container: HTMLElement) {
    return container.querySelector("[aria-roledescription]");
  }

  it("só leitura: o card não arrasta", () => {
    sessionStorage.setItem(
      "atlas.verComo",
      JSON.stringify({
        id: "6f1c2a7e-0000-4000-8000-000000000001",
        usuario: { id: 7, nome: "Coordenação" },
        admin: { id: 1, nome: "Admin" },
        iniciada_em: "2026-10-19T15:00:00Z",
        expira_em: "2099-10-19T16:00:00Z",
      }),
    );
    const { container } = render(<DemandaCard demanda={criarDemanda()} onClick={vi.fn()} />);

    expect(arrastavel(container)).toHaveAttribute("aria-disabled", "true");
  });

  it("fora do ver como, arrasta", () => {
    const { container } = render(<DemandaCard demanda={criarDemanda()} onClick={vi.fn()} />);

    expect(arrastavel(container)).toHaveAttribute("aria-disabled", "false");
  });
});
