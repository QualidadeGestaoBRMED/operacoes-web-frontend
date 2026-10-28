import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnidades } from "@/hooks/useUnidades";
import type { Unidade } from "@/types";
import { MapaConformidade } from "./MapaConformidade";

// Foco estreito: redirect de mobile e, agora (STC-513), o filtro de
// unidades da grade pra Coordenação da Unidade -- não é cobertura completa
// de MapaConformidade.tsx, os componentes filhos/hooks de dados viram
// stubs triviais.
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));

const filtrosDosDocumentos = vi.hoisted(() => [] as unknown[]);
vi.mock("@/hooks/useDocumentosLegalizacao", () => ({
  useDocumentosLegalizacao: (filtros: unknown) => (filtrosDosDocumentos.push(filtros), {
    documentos: [],
    carregandoPrimeiraVez: false,
    error: null,
    mensagemErro: null,
  }),
}));
// Stub mostra os nomes das unidades que chegaram na grade -- pra dar pra
// verificar o filtro do Coordenador sem simular a grade inteira.
vi.mock("./MatrizMapaGrid", () => ({
  MatrizMapaGrid: ({ grade }: { grade?: { unidades: Unidade[] } }) => (
    <div data-testid="unidades-da-grade">
      {grade?.unidades.map((unidade) => unidade.nome).join(",")}
    </div>
  ),
}));
vi.mock("./ResumoCards", () => ({ ResumoCards: () => null }));
vi.mock("./ToggleMapaLista", () => ({ ToggleMapaLista: () => <div data-testid="toggle-mapa" /> }));

const NITEROI: Unidade = { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" };
const VITORIA: Unidade = { id: 2, nome: "Vitória", codigo: "VIT", cidade: "Vitória", ativa: true, rede: "padrao" };

const push = vi.fn();
const replace = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push, replace } as never);
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [NITEROI, VITORIA],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: false,
    isCoordenacaoUnidade: false,
  } as never);
});

describe("MapaConformidade -- redirect de mobile", () => {
  it("renderiza o Mapa normalmente fora de mobile", () => {
    render(<MapaConformidade />);

    expect(screen.getByTestId("toggle-mapa")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("continua redirecionando em mobile, independente do perfil (comportamento já existente)", async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);

    render(<MapaConformidade />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/modulos/legalizacao"));
  });
});

describe("MapaConformidade -- grade só com a própria unidade pra Coordenação (STC-513)", () => {
  it("mostra todas as unidades da rede pra quem não é Coordenação da Unidade", () => {
    render(<MapaConformidade />);

    expect(screen.getByTestId("unidades-da-grade")).toHaveTextContent("Niterói,Vitória");
    expect(replace).not.toHaveBeenCalled();
  });

  it("Coordenação da Unidade não é mais redirecionada -- fica no Mapa, só com a própria unidade na grade", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: VITORIA.id },
      perfil: { id: 1, nome: "Coordenação", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);

    render(<MapaConformidade />);

    expect(screen.getByTestId("toggle-mapa")).toBeInTheDocument();
    expect(screen.getByTestId("unidades-da-grade")).toHaveTextContent("Vitória");
    expect(replace).not.toHaveBeenCalled();
  });

  // isCoordenacaoUnidade nasce false enquanto useSession ainda está
  // "loading" (useAuth.ts) -- sem esperar por isso, a grade renderizava de
  // vez com TODAS as unidades da rede pra depois, um instante depois,
  // estreitar pra só a do usuário: reabria o mesmo vazamento visual que
  // motivou esta issue (RJ Centro via de vez em quando dado de outra
  // unidade), só que como flash de dado em vez de navegação de volta pra
  // Lista.
  it("não renderiza a grade completa enquanto a sessão ainda carrega, mesmo com unidades já disponíveis", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: undefined,
      isLoading: true,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: false,
    } as never);

    render(<MapaConformidade />);

    expect(screen.getByTestId("unidades-da-grade")).toHaveTextContent("");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("MapaConformidade -- rede (STC-894)", () => {
  it("Ponto focal vê as unidades e os documentos de Operações Especiais", () => {
    filtrosDosDocumentos.length = 0;
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      isLoading: false,
      isCoordenacaoUnidade: true,
      isPontoFocal: true,
      redesAdministradas: [],
    } as never);

    render(<MapaConformidade />);

    expect(useUnidades).toHaveBeenCalledWith("opex");
    expect(filtrosDosDocumentos).toContainEqual({ rede: "opex" });
  });
});
