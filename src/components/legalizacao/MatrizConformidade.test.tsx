import { render, screen } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatrizConformidade } from "./MatrizConformidade";

// Foco estreito: só o suficiente pra exercitar a resincronização de
// documentoAbertoId <- URL (achado em code review, STC-443) -- não é
// cobertura completa de MatrizConformidade.tsx (sem teste próprio até
// aqui), os componentes filhos/hooks de dados viram stubs triviais.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/legalizacao",
  useSearchParams: vi.fn(),
}));

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

vi.mock("@/hooks/useAlturaSemLinhaCortada", () => ({
  useAlturaSemLinhaCortada: () => ({
    refPai: { current: null },
    refTabela: { current: null },
    maxHeight: undefined,
  }),
}));

vi.mock("./MatrizFiltros", () => ({ MatrizFiltros: () => null }));
vi.mock("./MatrizTable", () => ({ MatrizTable: () => null }));
vi.mock("./ToggleMapaLista", () => ({ ToggleMapaLista: () => null }));
// Stub só mostra o documentoId recebido, pra dar pra verificar sem simular
// o modal inteiro (que tem sua própria busca de dados).
vi.mock("./DetalheDocumentoModal", () => ({
  DetalheDocumentoModal: ({ documentoId }: { documentoId: number | null }) => (
    <div data-testid="documento-aberto">{documentoId ?? "nenhum"}</div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: vi.fn() } as never);
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
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    const { rerender } = render(<MatrizConformidade />);
    expect(screen.getByTestId("documento-aberto")).toHaveTextContent("nenhum");

    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ documento: "99" }) as never,
    );
    rerender(<MatrizConformidade />);

    expect(screen.getByTestId("documento-aberto")).toHaveTextContent("99");
  });
});
