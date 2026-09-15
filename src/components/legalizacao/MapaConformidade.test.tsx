import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MapaConformidade } from "./MapaConformidade";

// Foco estreito: só o redirect (mobile e, agora, Coordenação da Unidade,
// STC-451) -- não é cobertura completa de MapaConformidade.tsx, os
// componentes filhos/hooks de dados viram stubs triviais.
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));

vi.mock("@/hooks/useUnidades", () => ({
  useUnidades: () => ({ unidades: [], isLoading: false, error: null }),
}));
vi.mock("@/hooks/useDocumentosLegalizacao", () => ({
  useDocumentosLegalizacao: () => ({
    documentos: [],
    carregandoPrimeiraVez: false,
    error: null,
    mensagemErro: null,
  }),
}));
vi.mock("./MatrizMapaGrid", () => ({ MatrizMapaGrid: () => null }));
vi.mock("./ResumoCards", () => ({ ResumoCards: () => null }));
vi.mock("./ToggleMapaLista", () => ({ ToggleMapaLista: () => <div data-testid="toggle-mapa" /> }));

const push = vi.fn();
const replace = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push, replace } as never);
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: false,
    isCoordenacaoUnidade: false,
  } as never);
});

describe("MapaConformidade -- redirect pra Lista (STC-451)", () => {
  it("renderiza o Mapa normalmente fora de mobile e sem ser Coordenação da Unidade", () => {
    render(<MapaConformidade />);

    expect(screen.getByTestId("toggle-mapa")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redireciona pra Lista quando é Coordenação da Unidade, mesmo em desktop", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: { id: 1, nome: "Coordenação", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);

    render(<MapaConformidade />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/modulos/legalizacao"));
    expect(screen.queryByTestId("toggle-mapa")).not.toBeInTheDocument();
  });

  it("continua redirecionando em mobile, independente do perfil (comportamento já existente)", async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);

    render(<MapaConformidade />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/modulos/legalizacao"));
  });
});
