import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import type { Unidade } from "@/types";
import { MatrizFiltros } from "./MatrizFiltros";

// Foco estreito (STC-512): só o filtro de Unidade respeitando
// isCoordenacaoUnidade -- não é cobertura completa de MatrizFiltros.tsx
// (sem teste próprio até aqui), os demais hooks de dados viram stubs
// triviais.
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useUsuarios", () => ({ useUsuarios: () => ({ usuarios: [] }) }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/useDocumentosLegalizacao", () => ({
  useDocumentosLegalizacao: () => ({ documentos: [], error: null }),
}));

import { useUnidades } from "@/hooks/useUnidades";

const NITEROI: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

const VITORIA: Unidade = {
  id: 2,
  nome: "Vitória",
  codigo: "VIT",
  cidade: "Vitória",
  ativa: true,
  rede: "padrao",
};

function renderFiltros() {
  return render(
    <MatrizFiltros
      filtros={{}}
      onMudarFiltros={vi.fn()}
      busca=""
      onMudarBusca={vi.fn()}
      categoria={undefined}
      onMudarCategoria={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [NITEROI, VITORIA],
    isLoading: false,
    error: undefined,
  });
});

describe("MatrizFiltros -- filtro de Unidade respeita isCoordenacaoUnidade (STC-512)", () => {
  it("Admin/Setor vê todas as unidades no filtro, incluindo 'Todas as unidades'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: undefined,
      isLoading: false,
      isAdminQG: false,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
    } as never);
    const user = userEvent.setup();
    renderFiltros();

    await user.click(screen.getByLabelText("Unidade"));

    expect(await screen.findByRole("option", { name: "Niterói" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Vitória" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todas as unidades" })).toBeInTheDocument();
  });

  it("Coordenador só vê a própria unidade no filtro, não as outras da rede nem 'Todas as unidades'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: NITEROI.id },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    const user = userEvent.setup();
    renderFiltros();

    await user.click(screen.getByLabelText("Unidade"));

    expect(await screen.findByRole("option", { name: "Niterói" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Vitória" })).not.toBeInTheDocument();
    // STC-512 (review): a opção de sair do filtro da própria unidade não
    // pode nem aparecer -- "sem opção de trocar" era o pedido original.
    expect(
      screen.queryByRole("option", { name: "Todas as unidades" }),
    ).not.toBeInTheDocument();
  });
});
