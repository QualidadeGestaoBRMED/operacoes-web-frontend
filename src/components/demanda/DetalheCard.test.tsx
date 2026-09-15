import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnexos } from "@/hooks/useAnexos";
import { useComentarios } from "@/hooks/useComentarios";
import { useDemanda } from "@/hooks/useDemandas";
import { useHistorico } from "@/hooks/useHistorico";
import { criarDemanda } from "@/test-utils/fixtures";
import type { Demanda } from "@/types";
import { DetalheCard } from "./DetalheCard";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

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

const push = vi.fn();

function renderizar(
  podeEditar: boolean,
  overrides: Partial<Demanda> = {},
  onOpenChange = vi.fn(),
) {
  vi.mocked(useDemanda).mockReturnValue({
    demanda: criarDemanda({ pode_editar: podeEditar, ...overrides }),
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useDemanda>);

  render(<DetalheCard demandaId={1} onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({
    push,
  } as unknown as ReturnType<typeof useRouter>);
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
      unidade: { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true },
      area_responsavel: [],
    });

    expect(screen.getByText("Niterói")).toBeInTheDocument();
  });
});

describe("DetalheCard — link de origem (STC-451)", () => {
  it("mostra o link e navega pra origem_url quando presente, fechando o modal", async () => {
    const { onOpenChange } = renderizar(true, {
      origem_url: "/modulos/legalizacao?documento=59",
    });

    const link = screen.getByRole("button", { name: /ver documento de origem/i });
    link.click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/modulos/legalizacao?documento=59");
  });

  it("não mostra o link quando origem_url está vazio (demanda comum)", () => {
    renderizar(true, { origem_url: "" });

    expect(screen.queryByRole("button", { name: /ver documento de origem/i })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
