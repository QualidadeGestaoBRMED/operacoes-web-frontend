import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnexos } from "@/hooks/useAnexos";
import { useComentarios } from "@/hooks/useComentarios";
import { useDemanda } from "@/hooks/useDemandas";
import { useHistorico } from "@/hooks/useHistorico";
import { criarDemanda } from "@/test-utils/fixtures";
import type { Demanda } from "@/types";
import { DetalheCard } from "./DetalheCard";

vi.mock("@/hooks/useAnexos", () => ({ useAnexos: vi.fn() }));
vi.mock("@/hooks/useComentarios", () => ({ useComentarios: vi.fn(), fonteDaDemanda: vi.fn() }));
vi.mock("@/hooks/useDemandas", () => ({ useDemanda: vi.fn() }));
vi.mock("@/hooks/useHistorico", () => ({ useHistorico: vi.fn() }));

vi.mock("./AnexoList", () => ({ AnexoList: () => null }));
vi.mock("./ComentarioFeed", () => ({ ComentarioFeed: () => null }));
vi.mock("./HistoricoTimeline", () => ({ HistoricoTimeline: () => null }));
vi.mock("./ResponsavelSection", () => ({ ResponsavelSection: () => null }));
vi.mock("./TransicaoStatusSection", () => ({ TransicaoStatusSection: () => null }));
vi.mock("./EditarDemandaSection", () => ({
  EditarDemandaSection: ({ podeEditar }: { podeEditar: boolean }) => (
    <div data-testid="capacidade-edicao">{podeEditar ? "permitida" : "negada"}</div>
  ),
}));

function renderizar(podeEditar: boolean, overrides: Partial<Demanda> = {}) {
  vi.mocked(useDemanda).mockReturnValue({
    demanda: criarDemanda({ pode_editar: podeEditar, ...overrides }),
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useDemanda>);

  render(<DetalheCard demandaId={1} onOpenChange={vi.fn()} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useComentarios).mockReturnValue({
    comentarios: [],
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useComentarios>);
  vi.mocked(useAnexos).mockReturnValue({
    anexos: [],
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useAnexos>);
  vi.mocked(useHistorico).mockReturnValue({
    historico: [],
    isLoading: false,
    error: undefined,
    mensagemErro: null,
  });
});

describe("DetalheCard — capacidade de edição", () => {
  it("repassa a capacidade calculada pelo backend para a seção de edição", () => {
    renderizar(true);

    expect(screen.getByTestId("capacidade-edicao")).toHaveTextContent("permitida");
  });

  it("não infere edição no cliente quando o backend a nega", () => {
    renderizar(false);

    expect(screen.getByTestId("capacidade-edicao")).toHaveTextContent("negada");
  });
});

describe("DetalheCard — Pills de área responsável", () => {
  // STC-392: pedido no dogfooding -- mesmo critério de DemandaCard.tsx, um
  // Pill por área em vez de texto concatenado num Pill só.
  it("mostra um Pill separado por área, não texto concatenado", () => {
    renderizar(true, { unidade: null, area_responsavel: ["gerencia", "processo"] });

    expect(screen.getByText("Gerência")).toBeInTheDocument();
    expect(screen.getByText("Processo")).toBeInTheDocument();
    expect(screen.queryByText("Gerência, Processo")).not.toBeInTheDocument();
  });

  it("mostra a unidade num Pill só quando não há área responsável", () => {
    renderizar(true, {
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

    expect(screen.getByText("Niterói")).toBeInTheDocument();
  });
});

describe("DetalheCard em ver como (STC-790)", () => {
  afterEach(() => sessionStorage.clear());

  it("só leitura: sem edição, mesmo para quem pode editar", () => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify({"id":"6f1c2a7e-0000-4000-8000-000000000001","usuario":{"id":7,"nome":"Coordenação"},"admin":{"id":1,"nome":"Admin"},"iniciada_em":"2026-10-19T15:00:00Z","expira_em":"2099-10-19T16:00:00Z"}));
    renderizar(true);

    expect(screen.getByTestId("capacidade-edicao")).toHaveTextContent("negada");
  });
});

describe("DetalheCard — fechamento (STC-960)", () => {
  it("fechar não mostra a mensagem de falha durante a saída", async () => {
    const demanda = criarDemanda();
    vi.mocked(useDemanda).mockImplementation(
      (id) =>
        ({
          demanda: id === null ? undefined : demanda,
          isLoading: false,
          error: undefined,
          mensagemErro: null,
          mutate: vi.fn(),
        }) as ReturnType<typeof useDemanda>,
    );
    const { rerender } = render(<DetalheCard demandaId={1} onOpenChange={vi.fn()} />);
    const textos: string[] = [];
    const observador = new MutationObserver((mudancas) => {
      for (const mudanca of mudancas) {
        mudanca.addedNodes.forEach((no) => textos.push(no.textContent ?? ""));
      }
    });
    observador.observe(document.body, { childList: true, subtree: true });

    rerender(<DetalheCard demandaId={null} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    observador.disconnect();

    expect(textos.join("\n")).not.toContain("Não foi possível carregar esta demanda.");
    // Depois da saída, para de buscar a demanda.
    expect(vi.mocked(useDemanda)).toHaveBeenLastCalledWith(null);
  });
});
