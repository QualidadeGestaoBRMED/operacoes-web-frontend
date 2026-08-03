import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatarDataHora } from "@/lib/utils";
import type { Modulo, PermissaoUsuario, Unidade, Usuario } from "@/types";
import { PermissoesAdmin } from "./PermissoesAdmin";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import {
  criarPermissao,
  listarModulos,
  listarPerfis,
  listarPermissoes,
  listarSetores,
  listarUnidades,
  listarUsuarios,
  revogarPermissao,
} from "@/lib/plataforma";

const USUARIO: Usuario = {
  id: 5,
  username: "fernanda",
  email: "fernanda@grupobrmed.com.br",
  first_name: "Fernanda",
  last_name: "Lima",
  perfil: null,
  unidade_id: 2,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
};

const UNIDADE_NITEROI: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
};

const MODULO_GESTAO_DEMANDAS: Modulo = {
  id: 7,
  nome: "Gestão de Demandas",
  codigo: "gestao-demandas",
  descricao: "",
  status: "ativo",
  versao: "0.1.0",
};

const ADMIN_CONCEDENTE: Usuario = {
  id: 1,
  username: "nathalya",
  email: "nathalya@grupobrmed.com.br",
  first_name: "Nathalya",
  last_name: "Admin",
  perfil: null,
  unidade_id: null,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
};

function permissaoBase(overrides: Partial<PermissaoUsuario> = {}): PermissaoUsuario {
  return {
    id: 1,
    usuario: USUARIO.id,
    modulo: null,
    recurso: "gestao-demandas.kanban",
    acao: "visualizar",
    escopo_tipo: "unidade",
    unidade: UNIDADE_NITEROI.id,
    setor: null,
    concedido_por: ADMIN_CONCEDENTE.id,
    data_inicio: "2026-01-01",
    data_fim: null,
    ativo: true,
    created_at: "2026-01-15T14:30:00Z",
    ...overrides,
  };
}

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <PermissoesAdmin />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUsuarios).mockResolvedValue([USUARIO, ADMIN_CONCEDENTE]);
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE_NITEROI]);
  vi.mocked(listarSetores).mockResolvedValue([]);
  vi.mocked(listarPermissoes).mockResolvedValue([]);
  vi.mocked(listarModulos).mockResolvedValue([MODULO_GESTAO_DEMANDAS]);
  vi.mocked(listarPerfis).mockResolvedValue([]);
});

describe("PermissoesAdmin (STC-266)", () => {
  it("redireciona quem não é admin", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/modulos/gestao-demandas");
    });
  });

  it("não redireciona enquanto a sessão ainda está carregando", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: false,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(replace).not.toHaveBeenCalled();
  });

  it("lista permissões existentes com nome resolvido e status", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);

    renderTela();

    // Escopado à tabela de permissões: "Fernanda Lima" também aparece na
    // tabela de Perfil/Unidade/Setor (GerenciarUsuarios, mesma página).
    const tabela = within(await screen.findByRole("table", { name: /permissões individuais/i }));
    expect(tabela.getByText("Fernanda Lima")).toBeInTheDocument();
    // "Niterói" não é o texto inteiro do elemento (vem depois de "-- " no
    // mesmo <span>) -- regex casa por conter, não por igualdade exata.
    expect(tabela.getByText(/niterói/i)).toBeInTheDocument();
    expect(tabela.getByText("Ativa")).toBeInTheDocument();
  });

  // Achado no dogfooding: só o período de validade não bastava pra
  // auditoria -- faltava quem concedeu e quando.
  it("mostra quem concedeu e quando, na coluna 'Concedido'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);

    renderTela();

    // Escopado à tabela de permissões: "Nathalya Admin" (concedente) também
    // aparece na tabela de Perfil/Unidade/Setor, mesma página.
    const tabela = within(await screen.findByRole("table", { name: /permissões individuais/i }));
    expect(tabela.getByText("Nathalya Admin")).toBeInTheDocument();
    // formatarDataHora() reaproveitado em vez de calcular a string à mão --
    // o timestamp fixo (created_at) é UTC, e o fuso de quem roda o teste
    // muda a hora local exibida.
    expect(tabela.getByText(formatarDataHora(permissaoBase().created_at))).toBeInTheDocument();
  });

  it("mostra 'Revogada' pra permissão com ativo=false", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase({ ativo: false })]);

    renderTela();

    expect(await screen.findByText("Revogada")).toBeInTheDocument();
  });

  it("cria uma nova permissão com o payload certo", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: /nova permissão/i }));

    await user.click(screen.getByLabelText(/pessoa/i));
    await user.click(await screen.findByRole("option", { name: "Fernanda Lima" }));

    await user.click(screen.getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    const campoInicio = screen.getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");

    await user.click(screen.getByRole("button", { name: /conceder permissão/i }));

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: USUARIO.id,
          // modulo resolvido a partir do prefixo de "recurso" ("gestao-demandas")
          // batendo com o Modulo.codigo real, não hardcoded no formulário.
          modulo: MODULO_GESTAO_DEMANDAS.id,
          recurso: "gestao-demandas.kanban",
          acao: "visualizar",
          escopo_tipo: "unidade",
          unidade: UNIDADE_NITEROI.id,
          data_inicio: "2026-03-01",
        }),
      );
    });
  });

  // Achado no dogfooding: PermissaoUsuario.acao é uma ação só por registro
  // no backend -- marcar mais de uma no form precisa virar uma chamada por
  // ação, não uma chamada só com uma lista (que o backend rejeitaria).
  it("marcar mais de uma ação cria uma permissão pra cada uma", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: /nova permissão/i }));

    await user.click(screen.getByLabelText(/pessoa/i));
    await user.click(await screen.findByRole("option", { name: "Fernanda Lima" }));

    await user.click(screen.getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));

    // "Visualizar" já vem marcado por padrão -- adiciona "Editar" junto
    // (dropdown: precisa abrir antes de marcar a checkbox de dentro).
    await user.click(screen.getByLabelText(/^ação/i));
    await user.click(await screen.findByText("Editar"));

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    const campoInicio = screen.getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");

    await user.click(screen.getByRole("button", { name: /conceder permissão/i }));

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledTimes(2);
    });
    expect(criarPermissao).toHaveBeenCalledWith(expect.objectContaining({ acao: "visualizar" }));
    expect(criarPermissao).toHaveBeenCalledWith(expect.objectContaining({ acao: "editar" }));
  });

  // Achado ao usar a tela: marcar 3 ações num formulário só virava 3 linhas
  // na tabela (uma por PermissaoUsuario -- no backend, sempre uma ação só
  // por registro) -- agrupa de volta na exibição quando pessoa, concedente,
  // escopo e período batem.
  it("agrupa permissões nascidas do mesmo formulário em uma linha só", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar" }),
      permissaoBase({ id: 3, acao: "aprovar" }),
    ]);

    renderTela();

    const tabela = within(await screen.findByRole("table", { name: /permissões individuais/i }));
    expect(tabela.getByText("Fernanda Lima")).toBeInTheDocument();
    expect(tabela.getByText("Visualizar, Editar, Aprovar")).toBeInTheDocument();
    // uma linha só -- só um botão "Revogar", não três
    expect(tabela.getAllByRole("button", { name: "Revogar" })).toHaveLength(1);
  });

  it("não agrupa permissões de períodos diferentes (submissões distintas)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar", data_fim: "2026-02-01" }),
      permissaoBase({ id: 2, acao: "editar", data_fim: null }),
    ]);

    renderTela();

    expect(await screen.findByText("Visualizar")).toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revogar" })).toHaveLength(2);
  });

  it("ordena por 'Concedido' do mais recente pro mais antigo", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar", created_at: "2026-01-10T10:00:00Z" }),
      permissaoBase({ id: 2, acao: "editar", created_at: "2026-01-20T10:00:00Z" }),
      permissaoBase({ id: 3, acao: "aprovar", created_at: "2026-01-15T10:00:00Z" }),
    ]);

    renderTela();

    const tabela = await screen.findByRole("table", { name: /permissões individuais/i });
    const linhas = within(tabela).getAllByRole("row").slice(1); // pula o cabeçalho
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      expect.stringContaining("Editar"), // created_at mais recente (20/01)
      expect.stringContaining("Aprovar"), // 15/01
      expect.stringContaining("Visualizar"), // mais antiga (10/01)
    ]);
  });

  it("revoga todas as ações do grupo de uma vez", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar" }),
    ]);
    vi.mocked(revogarPermissao).mockResolvedValue(permissaoBase({ ativo: false }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: "Revogar" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revogar" }));

    await waitFor(() => {
      expect(revogarPermissao).toHaveBeenCalledTimes(2);
    });
    expect(revogarPermissao).toHaveBeenCalledWith(1);
    expect(revogarPermissao).toHaveBeenCalledWith(2);
  });

  it("revoga uma permissão ativa", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);
    vi.mocked(revogarPermissao).mockResolvedValue(permissaoBase({ ativo: false }));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: "Revogar" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revogar" }));

    await waitFor(() => {
      expect(revogarPermissao).toHaveBeenCalledWith(1);
    });
  });

  // Achado no dogfooding: com muitos usuários, "Perfil, unidade e setor"
  // (sem paginação) empurrava "Permissões individuais" pra fora da tela --
  // cada seção passou a repartir a altura 50/50 por padrão, com a opção de
  // expandir uma e esconder (não desmontar) a outra.
  it("expandir 'Permissões individuais' esconde 'Perfil, unidade e setor', e desfazer volta ao meio a meio", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    const secaoUsuarios = await screen.findByTestId("secao-usuarios");
    const secaoPermissoes = screen.getByTestId("secao-permissoes");

    expect(secaoUsuarios).not.toHaveClass("hidden");
    expect(secaoPermissoes).not.toHaveClass("hidden");

    await user.click(screen.getByRole("button", { name: /expandir permissões individuais/i }));

    expect(secaoUsuarios).toHaveClass("hidden");
    expect(secaoPermissoes).not.toHaveClass("hidden");

    await user.click(screen.getByRole("button", { name: /recolher permissões individuais/i }));

    expect(secaoUsuarios).not.toHaveClass("hidden");
    expect(secaoPermissoes).not.toHaveClass("hidden");
  });

  it("expandir 'Perfil, unidade e setor' esconde 'Permissões individuais'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    const secaoUsuarios = await screen.findByTestId("secao-usuarios");
    const secaoPermissoes = screen.getByTestId("secao-permissoes");

    await user.click(
      screen.getByRole("button", { name: /expandir perfil, unidade e setor/i }),
    );

    expect(secaoUsuarios).not.toHaveClass("hidden");
    expect(secaoPermissoes).toHaveClass("hidden");
  });
});
