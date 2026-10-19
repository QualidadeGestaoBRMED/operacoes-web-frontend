import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  iniciarVerComo,
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

  it("sem ninguém da rede, avisa em vez de mostrar a tabela vazia", async () => {
    comoAtor(PERFIL_ADMIN_OPEX, ["opex"]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ perfil: PERFIL_UNIDADE, unidade_id: UNIDADE.id }),
    ]);

    renderTela();

    expect(
      await screen.findByText("Nenhuma pessoa da sua rede para gerenciar ainda."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("não lista a própria conta", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ id: 999, perfil: PERFIL_GO })]);

    renderTela();

    await waitFor(() => expect(listarUsuarios).toHaveBeenCalled());
    expect(screen.queryByText("Fernanda Lima")).not.toBeInTheDocument();
  });

  it("enquanto usuários ou unidades carregam, não afirma que a rede está vazia", async () => {
    comoAtor(PERFIL_ADMIN_OPEX, ["opex"]);
    vi.mocked(listarUsuarios).mockResolvedValue([]);
    vi.mocked(listarUnidades).mockReturnValue(new Promise(() => {}));

    renderTela();

    expect(await screen.findByText("Carregando...")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma pessoa da sua rede para gerenciar ainda."),
    ).not.toBeInTheDocument();
  });

  it("falha ao carregar avisa o erro, não que a rede está vazia", async () => {
    comoAtor(PERFIL_ADMIN_OPEX, ["opex"]);
    vi.mocked(listarUsuarios).mockRejectedValue(new Error("rede"));

    renderTela();

    expect(
      await screen.findByText("Não foi possível carregar os usuários -- tente novamente."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma pessoa da sua rede para gerenciar ainda."),
    ).not.toBeInTheDocument();
  });

  it("sem a lista de cargos, a tabela não aparece como pronta", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarPerfis).mockReturnValue(new Promise(() => {}));

    renderTela();

    expect(await screen.findByText("Carregando...")).toBeInTheDocument();
    expect(screen.queryByText("Fernanda Lima")).not.toBeInTheDocument();
  });

  it("falha ao carregar os cargos avisa o erro", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarPerfis).mockRejectedValue(new Error("rede"));

    renderTela();

    expect(
      await screen.findByText("Não foi possível carregar os usuários -- tente novamente."),
    ).toBeInTheDocument();
  });

  it("trocar o cargo de quem está numa unidade fora da lista (desativada) tira a unidade", async () => {
    comoAtor(PERFIL_GO, ["opex", "padrao"]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ perfil: PERFIL_SETOR, unidade_id: 999 }),
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

  it("cada cargo da lista mostra o que ele faz, e a descrição cadastrada vale no lugar", async () => {
    vi.mocked(listarPerfis).mockResolvedValue([
      PERFIL_UNIDADE,
      { ...PERFIL_SETOR, descricao: "Descrição cadastrada no Django Admin." },
    ]);
    vi.mocked(listarUsuarios).mockResolvedValue([usuario({ perfil: PERFIL_UNIDADE })]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText(/alterar perfil de fernanda lima/i));

    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Coordenação de uma clínica da rede própria.")).toBeVisible();
    expect(within(listbox).getByText("Descrição cadastrada no Django Admin.")).toBeVisible();
    // O nome da opção continua só o cargo; a descrição chega ao leitor de
    // tela como descrição da opção.
    expect(within(listbox).getByRole("option", { name: "Setor" })).toHaveAccessibleDescription(
      "Descrição cadastrada no Django Admin.",
    );
    expect(within(listbox).getByRole("option", { name: "Unidade" })).toHaveAccessibleDescription(
      "Coordenação de uma clínica da rede própria.",
    );
  });
});


describe("GerenciarUsuarios, ordenação por coluna (STC-794)", () => {
  function pessoasNaTabela() {
    const tabela = screen.getByRole("table", { name: "Perfil, unidade e setor" });
    return within(tabela)
      .getAllByRole("row")
      .slice(1)
      .map((linha) => within(linha).getAllByRole("cell")[0].textContent);
  }

  beforeEach(() => {
    // Ordem da API diferente da crescente e da decrescente por nome.
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 2, first_name: "Bruno", perfil: null, setor_id: SETOR.id }),
      usuario({ id: 1, first_name: "Carla", perfil: PERFIL_UNIDADE, unidade_id: UNIDADE.id }),
      usuario({ id: 3, first_name: "Ana", perfil: PERFIL_SETOR }),
    ]);
  });

  it("clicar ordena crescente, depois decrescente, depois volta à ordem da API", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Carla Lima");
    const pessoa = screen.getByRole("button", { name: "Pessoa" });

    await user.click(pessoa);
    expect(pessoasNaTabela()).toEqual(["Ana Lima", "Bruno Lima", "Carla Lima"]);
    expect(screen.getByRole("columnheader", { name: "Pessoa" })).toHaveAttribute("aria-sort", "ascending");

    await user.click(pessoa);
    expect(pessoasNaTabela()).toEqual(["Carla Lima", "Bruno Lima", "Ana Lima"]);
    expect(screen.getByRole("columnheader", { name: "Pessoa" })).toHaveAttribute("aria-sort", "descending");

    await user.click(pessoa);
    expect(pessoasNaTabela()).toEqual(["Bruno Lima", "Carla Lima", "Ana Lima"]);
    expect(screen.getByRole("columnheader", { name: "Pessoa" })).not.toHaveAttribute("aria-sort");
  });

  it("sem unidade fica no fim nas duas direções", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Carla Lima");
    const unidade = screen.getByRole("button", { name: "Unidade" });

    await user.click(unidade);
    expect(pessoasNaTabela()[0]).toBe("Carla Lima");
    await user.click(unidade);
    // Decrescente: Carla continua primeiro, porque os sem unidade vão para o fim.
    expect(pessoasNaTabela()[0]).toBe("Carla Lima");
  });
});

describe("GerenciarUsuarios, ver como (STC-790)", () => {
  const navegar = vi.fn();

  beforeEach(() => {
    navegar.mockReset();
    vi.stubGlobal("location", { ...window.location, assign: navegar });
    vi.mocked(listarUsuarios).mockResolvedValue([
      usuario({ id: 1, first_name: "Carla", perfil: PERFIL_UNIDADE, unidade_id: UNIDADE.id }),
      usuario({ id: 2, first_name: "Quésia", perfil: PERFIL_QG }),
      usuario({ id: 3, first_name: "Bruno", perfil: null }),
    ]);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  function comoAdminQG() {
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 999, perfil: PERFIL_QG, redes_administradas: ["padrao", "opex"] },
      redesAdministradas: ["padrao", "opex"],
      administraRedePadrao: true,
      administraAsDuasRedes: true,
      isAdminOps: true,
      isAdminQG: true,
    } as unknown as ReturnType<typeof useAuth>);
  }

  it("Admin Q&G: o botão aparece para quem tem cargo, nunca para outro Admin Q&G", async () => {
    comoAdminQG();
    renderTela();
    await screen.findByText("Carla Lima");

    expect(screen.getByRole("button", { name: "Ver o Atlas como Carla Lima" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver o Atlas como Quésia/ })).not.toBeInTheDocument();
    // Sem cargo: não há o que ver como.
    expect(screen.queryByRole("button", { name: /Ver o Atlas como Bruno/ })).not.toBeInTheDocument();
  });

  it("outro Admin não vê o botão", async () => {
    renderTela();
    await screen.findByText("Carla Lima");

    expect(screen.queryByRole("button", { name: /Ver o Atlas como/ })).not.toBeInTheDocument();
  });

  it("clicar começa no backend, guarda a sessão nesta aba e abre o Atlas como a pessoa", async () => {
    comoAdminQG();
    const sessao = {
      id: "6f1c2a7e-0000-4000-8000-000000000001",
      usuario: { id: 1, nome: "Carla Lima" },
      admin: { id: 999, nome: "Admin" },
      iniciada_em: "2026-10-19T15:00:00Z",
      expira_em: "2099-10-19T16:00:00Z",
    };
    vi.mocked(iniciarVerComo).mockResolvedValue(sessao);
    renderTela();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Ver o Atlas como Carla Lima" }));

    expect(iniciarVerComo).toHaveBeenCalledWith(1);
    expect(JSON.parse(sessionStorage.getItem("atlas.verComo")!)).toEqual(sessao);
    expect(navegar).toHaveBeenCalledWith("/modulos/gestao-demandas");
  });
});

