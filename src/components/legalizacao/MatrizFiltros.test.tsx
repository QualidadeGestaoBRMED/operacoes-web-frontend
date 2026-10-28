import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import type { Unidade } from "@/types";
import type { DocumentoUnidadeFiltros } from "@/types/legalizacao";
import { MatrizFiltros } from "./MatrizFiltros";

// Foco estreito (STC-512): só o filtro de Unidade respeitando
// isCoordenacaoUnidade -- não é cobertura completa de MatrizFiltros.tsx
// (sem teste próprio até aqui), os demais hooks de dados viram stubs
// triviais.
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useUsuarios", () => ({ useUsuarios: () => ({ usuarios: [] }) }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
const filtrosDosDocumentos = vi.hoisted(() => [] as unknown[]);
vi.mock("@/hooks/useDocumentosLegalizacao", () => ({
  useDocumentosLegalizacao: (filtros: unknown) => (
    filtrosDosDocumentos.push(filtros), { documentos: [], error: null }
  ),
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

function renderFiltros(
  filtros: DocumentoUnidadeFiltros = {},
  extra: Partial<{
    emAtencao: boolean;
    onMudarFiltros: (filtros: DocumentoUnidadeFiltros) => void;
    onMudarEmAtencao: (emAtencao: boolean) => void;
  }> = {},
) {
  return render(
    <MatrizFiltros
      filtros={filtros}
      onMudarFiltros={extra.onMudarFiltros ?? vi.fn()}
      busca=""
      onMudarBusca={vi.fn()}
      categoria={undefined}
      onMudarCategoria={vi.fn()}
      emAtencao={extra.emAtencao ?? false}
      onMudarEmAtencao={extra.onMudarEmAtencao ?? vi.fn()}
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

describe("MatrizFiltros -- coordenação com unidades adicionais (STC-862)", () => {
  it("escolhe entre as suas unidades, com 'Todas as minhas unidades', e não as outras da rede", async () => {
    vi.mocked(useUnidades).mockReturnValue({
      unidades: [NITEROI, VITORIA, { ...VITORIA, id: 99, nome: "Outra" }],
      isLoading: false,
      error: undefined,
    });
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: NITEROI.id, unidades_adicionais_ids: [VITORIA.id] },
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
    expect(screen.getByRole("option", { name: "Vitória" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todas as minhas unidades" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Outra" })).not.toBeInTheDocument();
  });
});

describe("MatrizFiltros -- rede escolhida (STC-894)", () => {
  // Unidades e tipos do filtro "Documento" vêm da rede escolhida, sem
  // misturar as duas para quem vê as duas (code review da STC-894).
  it("unidades e tipos de documento da rede escolhida", () => {
    window.localStorage.setItem("atlas.legalizacao.rede", "opex");
    filtrosDosDocumentos.length = 0;
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 1 },
      isLoading: false,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      redesAdministradas: ["opex", "padrao"],
    } as never);
    renderFiltros();

    expect(useUnidades).toHaveBeenCalledWith("opex");
    expect(useUnidades).not.toHaveBeenCalledWith("padrao");
    expect(filtrosDosDocumentos).toContainEqual({ rede: "opex" });
    expect(filtrosDosDocumentos).not.toContainEqual(undefined);
    window.localStorage.clear();
  });
});

describe("MatrizFiltros -- 'Limpar filtros' não conta a unidade forçada do Coordenador (STC-512, review)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: NITEROI.id },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
  });

  it("não mostra 'Limpar filtros' pro Coordenador quando só a unidade (forçada) está preenchida", () => {
    renderFiltros({ unidade: NITEROI.id });

    expect(
      screen.queryByRole("button", { name: /limpar filtros/i }),
    ).not.toBeInTheDocument();
  });

  it("mostra 'Limpar filtros' pro Coordenador quando ele escolhe um filtro de verdade (ex. Status)", () => {
    renderFiltros({ unidade: NITEROI.id, status: "vencido" });

    expect(
      screen.getByRole("button", { name: /limpar filtros/i }),
    ).toBeInTheDocument();
  });

  it("Admin/Setor continua vendo 'Limpar filtros' normalmente ao escolher uma unidade", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: undefined,
      isLoading: false,
      isAdminQG: false,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
    } as never);

    renderFiltros({ unidade: NITEROI.id });

    expect(
      screen.getByRole("button", { name: /limpar filtros/i }),
    ).toBeInTheDocument();
  });
});


describe("MatrizFiltros -- opção Atenção no Status (STC-714)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: undefined, isCoordenacaoUnidade: false } as never);
  });

  it("escolher Atenção liga o filtro só-client e limpa o status do backend", async () => {
    const onMudarFiltros = vi.fn();
    const onMudarEmAtencao = vi.fn();
    const user = userEvent.setup();
    renderFiltros({ status: "vencido" }, { onMudarFiltros, onMudarEmAtencao });

    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "Atenção (a vencer ou protocolado)" }));

    expect(onMudarEmAtencao).toHaveBeenCalledWith(true);
    expect(onMudarFiltros).toHaveBeenCalledWith({ status: undefined });
  });

  it("escolher um status depois desliga a Atenção", async () => {
    const onMudarFiltros = vi.fn();
    const onMudarEmAtencao = vi.fn();
    const user = userEvent.setup();
    renderFiltros({}, { emAtencao: true, onMudarFiltros, onMudarEmAtencao });

    expect(screen.getByLabelText("Status")).toHaveTextContent("Atenção (a vencer ou protocolado)");
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "Vencido" }));

    expect(onMudarEmAtencao).toHaveBeenCalledWith(false);
    expect(onMudarFiltros).toHaveBeenCalledWith({ status: "vencido" });
  });

  it("Atenção conta como filtro ativo e 'Limpar filtros' desliga", async () => {
    const onMudarEmAtencao = vi.fn();
    const user = userEvent.setup();
    renderFiltros({}, { emAtencao: true, onMudarEmAtencao });

    await user.click(screen.getByRole("button", { name: /limpar filtros/i }));

    expect(onMudarEmAtencao).toHaveBeenCalledWith(false);
  });
});
