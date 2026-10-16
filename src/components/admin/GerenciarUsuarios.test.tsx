import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Perfil, Setor, Unidade, Usuario } from "@/types";
import { GerenciarUsuarios } from "./GerenciarUsuarios";

vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
// Ator padrão: Admin Operações (rede padrão), que não gerencia nem oferece
// cargos administrativos (STC-745).
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import {
  atualizarUsuario,
  listarPerfis,
  listarSetores,
  listarUnidades,
  listarUsuarios,
} from "@/lib/plataforma";

// Os 4 perfis reais do sistema (accounts/migrations/0003_seed_perfis.py) --
// nível é o único campo que a regra de negócio usa (accounts/permissions.py).
const PERFIL_QG: Perfil = { id: 1, nome: "Admin Q&G", descricao: "", nivel: 1 };
const PERFIL_OPS: Perfil = { id: 2, nome: "Admin Operações", descricao: "", nivel: 2 };
const PERFIL_UNIDADE: Perfil = { id: 3, nome: "Unidade", descricao: "", nivel: 3 };
const PERFIL_SETOR: Perfil = { id: 4, nome: "Setor", descricao: "", nivel: 4 };

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};
const SETOR: Setor = { id: 1, nome: "Financeiro", codigo: "FIN", modulo_id: null, ativo: true };

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 5,
    username: "fernanda",
    email: "fernanda@grupobrmed.com.br",
    first_name: "Fernanda",
    last_name: "Lima",
    perfil: null,
    unidade_id: null,
    setor_id: null,
    ativo: true,
    ultimo_acesso: null,
    foto_url: "",
    ...overrides,
  };
}

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <GerenciarUsuarios expandido={false} onAlternarExpandir={vi.fn()} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarPerfis).mockResolvedValue([PERFIL_QG, PERFIL_OPS, PERFIL_UNIDADE, PERFIL_SETOR]);
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarSetores).mockResolvedValue([SETOR]);
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(useAuth).mockReturnValue({
    user: { usuarioId: 999, perfil: PERFIL_OPS, redes_administradas: ["padrao"] },
    redesAdministradas: ["padrao"],
    administraRedePadrao: true,
    administraAsDuasRedes: false,
    isAdminOps: true,
  } as unknown as ReturnType<typeof useAuth>);
});

describe("GerenciarUsuarios (STC-266 -- extensão)", () => {
  // Regra do produto: promover/rebaixar alguém de ou pra um nível admin
  // continua exclusivo do Django Admin -- essa tela nem lista quem já é
  // Admin Q&G/Admin Operações, nem oferece esses níveis pra ninguém.
  it("não lista usuários com perfil Admin Q&G ou Admin Operações", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 1, first_name: "Nathalya", perfil: PERFIL_QG }),
      usuario({ id: 2, first_name: "Felipe", perfil: PERFIL_OPS }),
      usuario({ id: 3, first_name: "Carla", perfil: PERFIL_UNIDADE }),
      usuario({ id: 4, first_name: "Bruno", perfil: null }),
    ]);

    renderTela();

    expect(await screen.findByText("Carla Lima")).toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
    expect(screen.queryByText("Nathalya Lima")).not.toBeInTheDocument();
    expect(screen.queryByText("Felipe Lima")).not.toBeInTheDocument();
  });

  it("não oferece 'Admin Q&G' nem 'Admin Operações' como opção de perfil", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ perfil: PERFIL_UNIDADE })]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));

    expect(await screen.findByRole("option", { name: "Setor" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /admin q&g/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /admin operações/i })).not.toBeInTheDocument();
  });

  it("muda o perfil de um usuário", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);
    vi.mocked(atualizarUsuario).mockResolvedValue(usuario({ perfil: PERFIL_SETOR }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));
    await user.click(await screen.findByRole("option", { name: "Setor" }));

    await waitFor(() => {
      expect(atualizarUsuario).toHaveBeenCalledWith(5, { perfil_id: 4 });
    });
  });

  it("muda a unidade de um usuário", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);
    vi.mocked(atualizarUsuario).mockResolvedValue(usuario({ unidade_id: 1 }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar unidade de fernanda lima/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    await waitFor(() => {
      expect(atualizarUsuario).toHaveBeenCalledWith(5, { unidade_id: 1 });
    });
  });

  it("desvincula o setor de um usuário (opção 'Sem setor')", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ setor_id: SETOR.id })]);
    vi.mocked(atualizarUsuario).mockResolvedValue(usuario({ setor_id: null }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar setor de fernanda lima/i));
    await user.click(await screen.findByRole("option", { name: "Sem setor" }));

    await waitFor(() => {
      expect(atualizarUsuario).toHaveBeenCalledWith(5, { setor_id: null });
    });
  });

  it("filtra por perfil", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 1, first_name: "Carla", perfil: PERFIL_UNIDADE }),
      usuario({ id: 2, first_name: "Bruno", perfil: PERFIL_SETOR }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Carla Lima")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/filtrar por perfil/i));
    await user.click(await screen.findByRole("option", { name: "Setor" }));

    expect(screen.queryByText("Carla Lima")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
  });

  it("filtra por unidade", async () => {
    const VITORIA: Unidade = {
      id: 2,
      nome: "Vitória",
      codigo: "VIT",
      cidade: "Vitória",
      ativa: true,
      rede: "padrao",
    };
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, VITORIA]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 1, first_name: "Carla", unidade_id: UNIDADE.id }),
      usuario({ id: 2, first_name: "Bruno", unidade_id: VITORIA.id }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Carla Lima")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/filtrar por unidade/i));
    await user.click(await screen.findByRole("option", { name: "Vitória" }));

    expect(screen.queryByText("Carla Lima")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
  });

  it("mostra mensagem e permite limpar quando os filtros não encontram ninguém", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 1, first_name: "Carla", perfil: PERFIL_UNIDADE }),
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/filtrar por perfil/i));
    await user.click(await screen.findByRole("option", { name: "Setor" }));

    expect(
      await screen.findByText("Nenhuma pessoa encontrada com esses filtros."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /limpar filtros/i }));

    expect(await screen.findByText("Carla Lima")).toBeInTheDocument();
  });

  // STC-505 (achado no code review): nada garantia que o ramo mobile
  // (ehMobile) continuasse sem altura travada -- ver GerenciarUsuarios.tsx
  // pro racional completo (ehMobile ? undefined : {maxHeight}).
  it("no mobile, o container da tabela não trava a própria altura", async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);

    renderTela();

    const tabela = await screen.findByRole("table", {
      name: "Perfil, unidade e setor",
    });
    const container = tabela.parentElement;
    expect(container).not.toBeNull();
    expect(container).not.toHaveClass("overflow-y-auto");
    expect(container?.style.maxHeight).toBe("");
  });

  // STC-505 (achado no code review, 3ª rodada): os testes anteriores só
  // cobriam o efeito colateral (altura no mobile) -- nenhum cobria o fix
  // central que a issue pediu de fato (perder o contexto de qual linha é
  // qual ao rolar horizontalmente). sticky left-0 é o que resolve isso.
  it("mantém a coluna 'Pessoa' fixa (sticky left-0) ao rolar a tabela horizontalmente", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);

    renderTela();

    const cabecalho = await screen.findByRole("columnheader", { name: "Pessoa" });
    expect(cabecalho).toHaveClass("sticky", "left-0");

    const celula = screen.getByRole("cell", { name: "Fernanda Lima" });
    expect(celula).toHaveClass("sticky", "left-0");
  });
});

describe("GerenciarUsuarios -- cargos por rede (STC-747)", () => {
  const PERFIL_PONTO_FOCAL: Perfil = { id: 5, nome: "Ponto focal (OPEX)", descricao: "", nivel: 5 };
  const PERFIL_GO: Perfil = { id: 6, nome: "Gestão de Operações", descricao: "", nivel: 6 };
  const PERFIL_ADMIN_OPEX: Perfil = {
    id: 7,
    nome: "Admin Operações Especiais",
    descricao: "",
    nivel: 7,
  };
  const AERO: Unidade = {
    id: 2,
    nome: "Aeroclínica Macaé",
    codigo: "AMC",
    cidade: "Macaé",
    ativa: true,
    rede: "opex",
  };

  function comoAtor(perfil: Perfil, redes: ("padrao" | "opex")[]) {
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 999, perfil, redes_administradas: redes },
      redesAdministradas: redes,
      administraRedePadrao: redes.includes("padrao"),
      administraAsDuasRedes: redes.length === 2,
      isAdminOps: true,
    } as unknown as ReturnType<typeof useAuth>);
  }

  beforeEach(() => {
    vi.mocked(listarPerfis).mockResolvedValue([
      PERFIL_QG,
      PERFIL_OPS,
      PERFIL_UNIDADE,
      PERFIL_SETOR,
      PERFIL_PONTO_FOCAL,
      PERFIL_GO,
      PERFIL_ADMIN_OPEX,
    ]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, AERO]);
  });

  it("Gestão de Operações lista Admins de rede e oferece esses cargos, não Q&G nem o próprio", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ perfil: PERFIL_OPS })]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));

    expect(await screen.findByRole("option", { name: "Admin Operações Especiais" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin Q&G" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gestão de Operações" })).not.toBeInTheDocument();
  });

  it("Admin Operações Especiais só vê quem é da rede OPEX, com as unidades dela", async () => {
    comoAtor(PERFIL_ADMIN_OPEX, ["opex"]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 5, perfil: PERFIL_PONTO_FOCAL, unidade_id: AERO.id }),
      usuario({ id: 6, first_name: "Carla", perfil: PERFIL_UNIDADE, unidade_id: UNIDADE.id }),
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar unidade de fernanda lima/i));

    expect(screen.queryByText("Carla Lima")).not.toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Aeroclínica Macaé" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Niterói" })).not.toBeInTheDocument();
    // Setor não tem rede: é da rede padrão.
    expect(screen.getByLabelText(/alterar setor de fernanda lima/i)).toBeDisabled();
  });

  it("trocar para um cargo de outra rede tira a unidade junto", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ perfil: PERFIL_UNIDADE, unidade_id: UNIDADE.id }),
    ]);
    vi.mocked(atualizarUsuario).mockResolvedValue(usuario({ perfil: PERFIL_PONTO_FOCAL }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));
    await user.click(await screen.findByRole("option", { name: "Ponto focal (OPEX)" }));

    await waitFor(() =>
      expect(atualizarUsuario).toHaveBeenCalledWith(5, { perfil_id: 5, unidade_id: null }),
    );
  });

  it("não lista a própria conta", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ id: 999, perfil: PERFIL_GO })]);

    renderTela();

    await waitFor(() => expect(listarUsuarios).toHaveBeenCalled());
    expect(screen.queryByText("Fernanda Lima")).not.toBeInTheDocument();
  });
});
