import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnexos } from "@/hooks/useAnexos";
import { useComentarios } from "@/hooks/useComentarios";
import { useDemanda } from "@/hooks/useDemandas";
import { useHistorico } from "@/hooks/useHistorico";
import { criarDemanda } from "@/test-utils/fixtures";
import type { Demanda } from "@/types";
import { DetalheCard } from "./DetalheCard";

vi.mock("@/hooks/useAnexos", () => ({ useAnexos: vi.fn() }));
vi.mock("@/hooks/useComentarios", () => ({ useComentarios: vi.fn() }));
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
