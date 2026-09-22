import { render, screen } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import type { Unidade } from "@/types";
import { MatrizConformidade } from "./MatrizConformidade";

// Foco estreito: resincronização de documentoAbertoId <- URL (STC-443), o
// toggle do Mapa por perfil (STC-451) e, agora, o filtro de unidade forçado
// pro Coordenador (STC-512) -- não é cobertura completa de
// MatrizConformidade.tsx, os componentes filhos/hooks de dados viram stubs
// triviais.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/legalizacao",
  useSearchParams: vi.fn(),
}));

vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useDocumentosLegalizacao", () => ({
  useDocumentosLegalizacao: vi.fn(),
}));

vi.mock("@/hooks/useAlturaSemLinhaCortada", () => ({
  useAlturaSemLinhaCortada: () => ({
    refPai: { current: null },
    refTabela: { current: null },
    maxHeight: undefined,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

// Stub mostra o filtros.unidade recebido -- pra dar pra verificar a
// pré-seleção forçada pro Coordenador (STC-512, review) sem simular o
// componente inteiro de filtros.
vi.mock("./MatrizFiltros", () => ({
  MatrizFiltros: ({ filtros }: { filtros: { unidade?: number } }) => (
    <div data-testid="unidade-filtro">{filtros.unidade ?? "todas"}</div>
  ),
}));
vi.mock("./MatrizTable", () => ({ MatrizTable: () => null }));
// Stub mostra mostrarMapa recebido (STC-451) -- pra dar pra verificar sem
// simular o segmented control inteiro.
vi.mock("./ToggleMapaLista", () => ({
  ToggleMapaLista: ({ mostrarMapa }: { mostrarMapa?: boolean }) => (
    <div data-testid="mostra-mapa">{String(mostrarMapa)}</div>
  ),
}));
// Stub só mostra o documentoId recebido, pra dar pra verificar sem simular
// o modal inteiro (que tem sua própria busca de dados).
vi.mock("./DetalheDocumentoModal", () => ({
  DetalheDocumentoModal: ({ documentoId }: { documentoId: number | null }) => (
    <div data-testid="documento-aberto">{documentoId ?? "nenhum"}</div>
  ),
}));

const NITEROI: Unidade = { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" };
const VITORIA: Unidade = { id: 2, nome: "Vitória", codigo: "VIT", cidade: "Vitória", ativa: true, rede: "padrao" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [NITEROI, VITORIA],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(useDocumentosLegalizacao).mockReturnValue({
    documentos: [],
    carregandoPrimeiraVez: false,
    error: null,
    mensagemErro: null,
  } as never);
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: false,
    isCoordenacaoUnidade: false,
  } as never);
});

describe("MatrizConformidade -- resincronização de documentoAbertoId (STC-443)", () => {
  it("abre o documento se ?documento= já vem na URL na montagem", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ documento: "57" }) as never,
    );

    render(<MatrizConformidade />);

    expect(screen.getByTestId("documento-aberto")).toHaveTextContent("57");
  });

  // Achado em code review: AlertaPersistenteModal.tsx (montado fora desta
  // rota, em AppShell.tsx) pode mandar router.push(?documento=) com o
  // usuário já NESTA tela -- só troca a querystring, não remonta o
  // componente. O useState original só lia a URL na montagem e nunca
  // pegava esse id novo; agora precisa resincronizar.
  it("abre o documento quando ?documento= muda DEPOIS da montagem (deep link vindo de fora da rota)", () => {
    const { rerender } = render(<MatrizConformidade />);
    expect(screen.getByTestId("documento-aberto")).toHaveTextContent("nenhum");

    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ documento: "99" }) as never,
    );
    rerender(<MatrizConformidade />);

    expect(screen.getByTestId("documento-aberto")).toHaveTextContent("99");
  });
});

describe("MatrizConformidade -- Mapa escondido pra Coordenação da Unidade (STC-451)", () => {
  it("mostra o Mapa pra quem não é Coordenação da Unidade", () => {
    render(<MatrizConformidade />);

    expect(screen.getByTestId("mostra-mapa")).toHaveTextContent("true");
  });

  it("esconde o Mapa pra Coordenação da Unidade -- ela só acompanha a própria unidade", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: { id: 1, nome: "Coordenação", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);

    render(<MatrizConformidade />);

    expect(screen.getByTestId("mostra-mapa")).toHaveTextContent("false");
  });
});

describe("MatrizConformidade -- Coordenador só filtra a própria unidade, sem opção de trocar (STC-512, review)", () => {
  it("Admin/Setor abre sem nenhum filtro de unidade forçado", () => {
    render(<MatrizConformidade />);

    expect(screen.getByTestId("unidade-filtro")).toHaveTextContent("todas");
  });

  it("Coordenador tem a própria unidade pré-selecionada automaticamente, mesmo sem nada na URL", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: VITORIA.id },
      perfil: { id: 1, nome: "Coordenação", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);

    render(<MatrizConformidade />);

    expect(screen.getByTestId("unidade-filtro")).toHaveTextContent(String(VITORIA.id));
  });

  it("Coordenador não consegue sair da própria unidade via URL -- o filtro é forçado de volta", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ unidade: String(NITEROI.id) }) as never,
    );
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: VITORIA.id },
      perfil: { id: 1, nome: "Coordenação", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);

    render(<MatrizConformidade />);

    expect(screen.getByTestId("unidade-filtro")).toHaveTextContent(String(VITORIA.id));
  });

  // isCoordenacaoUnidade nasce false enquanto a sessão carrega (useAuth.ts)
  // -- sem pausar a busca também por isso, a 1ª chamada a /documentos/ podia
  // sair sem filtro de unidade nenhum pro Coordenador, trazendo a rede
  // inteira por um instante.
  it("não busca documentos enquanto a sessão ainda carrega, mesmo com unidades já disponíveis", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: undefined,
      isLoading: true,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: false,
    } as never);

    render(<MatrizConformidade />);

    const [, opcoes] = vi.mocked(useDocumentosLegalizacao).mock.calls[0];
    expect(opcoes).toMatchObject({ desabilitado: true });
  });
});
