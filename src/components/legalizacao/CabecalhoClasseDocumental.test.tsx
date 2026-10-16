import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TipoDocumentoRegulatorio } from "@/types/legalizacao";
import { CabecalhoClasseDocumental } from "./CabecalhoClasseDocumental";

vi.mock("@/hooks/useTiposDocumento", () => ({ useTiposDocumento: vi.fn() }));

import { useTiposDocumento } from "@/hooks/useTiposDocumento";

function tipo(extra: Partial<TipoDocumentoRegulatorio>): TipoDocumentoRegulatorio {
  return {
    id: 1,
    codigo: "alvara",
    nome: "Alvará de Funcionamento",
    categoria: "regularizacao",
    area_responsavel: "legalizacao",
    setor_apoio: "",
    exige_validade: true,
    exige_protocolo: false,
    exige_evidencia: true,
    controlado_por_profissional: false,
    permite_multiplas_instancias: false,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

function catalogo(tipos: TipoDocumentoRegulatorio[], extra: Partial<ReturnType<typeof useTiposDocumento>> = {}) {
  vi.mocked(useTiposDocumento).mockReturnValue({
    tiposDocumento: tipos,
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    ...extra,
  });
}

beforeEach(() => {
  catalogo([
    tipo({ id: 1 }),
    tipo({
      id: 2,
      codigo: "avcb",
      nome: "AVCB",
      area_responsavel: "coordenacao",
      setor_apoio: "Manutenção",
    }),
    tipo({ id: 3, codigo: "antigo", nome: "Licença antiga", ativo: false }),
    tipo({ id: 4, codigo: "pgrss", nome: "PGRSS", categoria: "programas" }),
  ]);
});

describe("CabecalhoClasseDocumental", () => {
  it("lista só os tipos ativos da classe, com a área responsável", async () => {
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="regularizacao" />);

    await user.click(screen.getByRole("button", { name: /ver os tipos de documento/ }));
    const popover = await screen.findByRole("dialog");

    const itens = within(popover).getAllByRole("listitem");
    expect(itens.map((item) => item.querySelector("p")?.textContent)).toEqual([
      "Alvará de Funcionamento",
      "AVCB",
    ]);
    expect(itens[0]).toHaveTextContent("Legalização");
    expect(itens[1]).toHaveTextContent("Coordenação da Unidade");
    expect(itens[1]).not.toHaveTextContent("Manutenção");
    // O texto inteiro, com os rótulos, fica no title (o item corta com reticências).
    expect(within(itens[0]).getByTitle("Responsável: Legalização")).toBeInTheDocument();
    expect(within(itens[1]).getByTitle("Responsável: Coordenação da Unidade")).toBeInTheDocument();
    expect(within(itens[0]).getByTitle("Alvará de Funcionamento")).toBeInTheDocument();
    expect(within(popover).queryByText("Licença antiga")).not.toBeInTheDocument();
    expect(within(popover).queryByText("PGRSS")).not.toBeInTheDocument();
  });

  it("classe sem tipo ativo avisa que não há tipo cadastrado", async () => {
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="residuos" />);

    await user.click(screen.getByRole("button", { name: /ver os tipos de documento/ }));
    expect(await screen.findByText("Nenhum tipo de documento cadastrado nesta classe")).toBeInTheDocument();
  });

  it("abre pelo teclado e fecha com Esc", async () => {
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="regularizacao" />);

    await user.tab();
    expect(screen.getByRole("button", { name: /ver os tipos de documento/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toHaveTextContent("AVCB");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre ao passar o mouse, e o clique seguinte mantém aberto", async () => {
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="regularizacao" />);
    const botao = screen.getByRole("button", { name: /ver os tipos de documento/ });

    await user.hover(botao);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(botao);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(botao);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mouse que só passa pelo cabeçalho não abre", async () => {
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="regularizacao" />);
    const botao = screen.getByRole("button", { name: /ver os tipos de documento/ });

    await user.hover(botao);
    await user.unhover(botao);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falha ao carregar o catálogo aparece no Popover", async () => {
    catalogo([], { mensagemErro: "Erro" });
    const user = userEvent.setup();
    render(<CabecalhoClasseDocumental categoria="regularizacao" />);

    await user.click(screen.getByRole("button", { name: /ver os tipos de documento/ }));
    expect(await screen.findByText("Não foi possível carregar os tipos de documento.")).toBeInTheDocument();
  });
});
