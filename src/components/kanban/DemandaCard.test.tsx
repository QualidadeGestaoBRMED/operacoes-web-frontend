import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
