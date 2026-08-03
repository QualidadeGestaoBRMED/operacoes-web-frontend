import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Perfil, Setor, Unidade, Usuario } from "@/types";
import { GerenciarUsuarios } from "./GerenciarUsuarios";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import {
  atualizarUsuario,
  listarPerfis,
  listarSetores,
  listarUnidades,
  listarUsuarios,
} from "@/lib/plataforma";

const PERFIL_QG: Perfil = { id: 1, nome: "Admin Q&G", descricao: "", nivel: 1 };
const PERFIL_OPS: Perfil = { id: 2, nome: "Admin Operações", descricao: "", nivel: 2 };
const PERFIL_ANALISTA: Perfil = { id: 3, nome: "Analista", descricao: "", nivel: 5 };

const UNIDADE: Unidade = { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true };
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
    ...overrides,
  };
}

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <GerenciarUsuarios />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarPerfis).mockResolvedValue([PERFIL_QG, PERFIL_OPS, PERFIL_ANALISTA]);
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarSetores).mockResolvedValue([SETOR]);
});

describe("GerenciarUsuarios (STC-266 -- extensão)", () => {
  it("Admin Q&G vê a opção 'Admin Q&G' na lista de perfis", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: true } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));

    expect(await screen.findByRole("option", { name: /admin q&g/i })).toBeInTheDocument();
  });

  // Espelha UsuarioSerializer.validate_perfil_id() (backend): só Admin Q&G
  // atribui o nível Admin Q&G -- não faz sentido nem oferecer a opção pra
  // quem não pode usá-la.
  it("Admin Operações não vê a opção 'Admin Q&G' na lista de perfis", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));

    expect(await screen.findByRole("option", { name: /analista/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /admin q&g/i })).not.toBeInTheDocument();
  });

  it("Admin Operações não consegue editar o perfil de quem já é Admin Q&G", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ first_name: "Nathalya", perfil: PERFIL_QG }),
    ]);

    renderTela();

    expect(await screen.findByLabelText(/alterar perfil de nathalya lima/i)).toBeDisabled();
  });

  it("muda o perfil de um usuário", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: true } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario()]);
    vi.mocked(atualizarUsuario).mockResolvedValue(usuario({ perfil: PERFIL_ANALISTA }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));
    await user.click(await screen.findByRole("option", { name: /analista/i }));

    await waitFor(() => {
      expect(atualizarUsuario).toHaveBeenCalledWith(5, { perfil_id: 3 });
    });
  });

  it("muda a unidade de um usuário", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: true } as ReturnType<typeof useAuth>);
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
    vi.mocked(useAuth).mockReturnValue({ isAdminQG: true } as ReturnType<typeof useAuth>);
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
});
