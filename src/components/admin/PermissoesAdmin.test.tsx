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
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import { listarDocumentosLegalizacao } from "@/lib/legalizacao";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
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
  foto_url: "",
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
  recursos_permissao: [
    {
      id: 1,
      chave: "gestao-demandas.kanban",
      rotulo: "Kanban de Demandas",
      acoes_suportadas: ["visualizar", "editar"],
    },
  ],
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
  foto_url: "",
};

function permissaoBase(
  overrides: Partial<PermissaoUsuario> = {},
): PermissaoUsuario {
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
  vi.mocked(listarTiposDocumento).mockResolvedValue([]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
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
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
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
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    expect(tabela.getByText("Nathalya Admin")).toBeInTheDocument();
    // formatarDataHora() reaproveitado em vez de calcular a string à mão --
    // o timestamp fixo (created_at) é UTC, e o fuso de quem roda o teste
    // muda a hora local exibida.
    expect(
      tabela.getByText(formatarDataHora(permissaoBase().created_at)),
    ).toBeInTheDocument();
  });

  it("mostra 'Revogada' pra permissão com ativo=false", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ ativo: false }),
    ]);

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
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    // Escopado ao diálogo: STC-415 mantém "Catálogo de Legalização" sempre
    // montado (só escondido via `hidden`), e seus formulários (Unidade,
    // Tipo de documento etc.) agora ficam sempre presentes no DOM também --
    // getByLabelText não filtra por `hidden` como getByRole já faz.
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText(/pessoa/i));
    await user.click(
      await screen.findByRole("option", { name: "Fernanda Lima" }),
    );

    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));

    await user.click(within(dialog).getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");

    await user.click(
      within(dialog).getByRole("button", { name: /conceder permissão/i }),
    );

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: USUARIO.id,
          // STC-422: modulo vem junto do catálogo (recurso achatado carrega
          // moduloId), não mais inferido por prefixo de string.
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

  it("Editar cria apenas uma permissão, pois já implica Visualizar no backend", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    // Escopado ao diálogo -- ver comentário equivalente no teste anterior.
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText(/pessoa/i));
    await user.click(
      await screen.findByRole("option", { name: "Fernanda Lima" }),
    );

    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));

    await user.click(within(dialog).getByLabelText(/^ação/i));
    await user.click(await screen.findByRole("option", { name: "Editar" }));

    await user.click(within(dialog).getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");

    await user.click(
      within(dialog).getByRole("button", { name: /conceder permissão/i }),
    );

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledTimes(1);
    });
    expect(criarPermissao).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "editar" }),
    );
  });

  it("oferece somente uma escolha entre Visualizar e Editar", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    await user.click(screen.getByLabelText(/^ação/i));

    expect(
      await screen.findByRole("option", { name: "Visualizar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Editar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Excluir" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Restaurar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Configurar" }),
    ).not.toBeInTheDocument();
  });

  it("STC-422: um Modulo sem recursos_permissao não derruba a página (achado no code review)", async () => {
    // recursos_permissao é sempre presente no contrato real (ModuloSerializer
    // sempre serializa a lista, mesmo vazia), mas nada garante isso em
    // runtime -- uma resposta em cache de uma versão anterior do backend,
    // por exemplo. Cast forçado de propósito: simula exatamente esse
    // contrato quebrado, que TypeScript sozinho não pega (só existe em
    // runtime, não em compile-time).
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      { ...MODULO_GESTAO_DEMANDAS, recursos_permissao: undefined },
    ] as unknown as Modulo[]);

    renderTela();

    expect(
      await screen.findByRole("button", { name: /nova permissão/i }),
    ).toBeInTheDocument();
  });

  it("STC-422: um recurso novo no catálogo aparece no dropdown sem mudar o formulário", async () => {
    // Critério de aceite da issue: recurso novo no catálogo do backend
    // aparece em Conceder permissão sem PR de frontend -- aqui simulado
    // com um módulo/recurso que não existia nas versões anteriores deste
    // teste (nenhum código de FormNovaPermissao.tsx precisou mudar).
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      MODULO_GESTAO_DEMANDAS,
      {
        id: 8,
        nome: "Legalização",
        codigo: "legalizacao",
        descricao: "",
        status: "ativo",
        versao: "0.1.0",
        recursos_permissao: [
          {
            id: 2,
            chave: "legalizacao.documentos",
            rotulo: "Documentos de Legalização",
            acoes_suportadas: ["visualizar", "editar"],
          },
        ],
      },
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    await user.click(screen.getByLabelText(/recurso/i));

    expect(
      await screen.findByRole("option", { name: /documentos de legalização/i }),
    ).toBeInTheDocument();
  });

  it("STC-422: Ação só oferece o que o recurso escolhido suporta, e desmarca uma escolha que deixou de valer", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      MODULO_GESTAO_DEMANDAS,
      {
        id: 8,
        nome: "Legalização",
        codigo: "legalizacao",
        descricao: "",
        status: "ativo",
        versao: "0.1.0",
        recursos_permissao: [
          // Só "visualizar" de propósito -- prova que a lista de Ação não é
          // mais um array fixo, e sim derivada do recurso escolhido.
          {
            id: 2,
            chave: "legalizacao.documentos",
            rotulo: "Documentos de Legalização",
            acoes_suportadas: ["visualizar"],
          },
        ],
      },
    ]);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText(/pessoa/i));
    await user.click(
      await screen.findByRole("option", { name: "Fernanda Lima" }),
    );

    // Escolhe "editar" pro recurso do Kanban primeiro (suporta as duas).
    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));
    await user.click(within(dialog).getByLabelText(/^ação/i));
    await user.click(await screen.findByRole("option", { name: "Editar" }));

    // Troca pro recurso que só suporta "visualizar" -- achado ao tornar Ação
    // dependente do catálogo: sem o efeito de reset, "editar" continuaria
    // selecionado por baixo mesmo sumindo da lista visível.
    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(
      await screen.findByRole("option", { name: /documentos de legalização/i }),
    );

    await user.click(within(dialog).getByLabelText(/^ação/i));
    expect(
      await screen.findByRole("option", { name: "Visualizar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Editar" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Visualizar" }));

    await user.click(within(dialog).getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");
    await user.click(
      within(dialog).getByRole("button", { name: /conceder permissão/i }),
    );

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({
          recurso: "legalizacao.documentos",
          acao: "visualizar",
        }),
      );
    });
  });

  it("STC-422: coluna 'Recurso' mostra o módulo e o rótulo do catálogo", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);

    renderTela();

    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    expect(
      tabela.getByText("Gestão de Demandas -- Kanban de Demandas"),
    ).toBeInTheDocument();
  });

  it("STC-422: coluna 'Recurso' cai pra chave crua se o recurso não estiver mais no catálogo", async () => {
    // Defensivo: uma permissão histórica pode apontar pra um recurso que
    // saiu do catálogo depois -- a linha não deve sumir nem quebrar.
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ recurso: "modulo-antigo.recurso-removido" }),
    ]);

    renderTela();

    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    expect(
      tabela.getByText("modulo-antigo.recurso-removido"),
    ).toBeInTheDocument();
  });

  it("STC-422: Renovar com um recurso que não existe mais no catálogo mostra a chave em vez de deixar o Select em branco", async () => {
    // Achado no code review: sem isso, o Select ficava vazio (nem
    // "Selecionar...", nem o valor real) escondendo que o campo ainda
    // guardava essa chave por baixo -- um Renovar sem tocar em Recurso
    // criava uma permissão com modulo: null em silêncio.
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({
        ativo: false,
        data_fim: "2026-01-15",
        recurso: "modulo-antigo.recurso-removido",
      }),
    ]);
    const user = userEvent.setup();

    renderTela();
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    await user.click(await tabela.findByRole("button", { name: "Reativar" }));

    const dialog = await screen.findByRole("dialog", {
      name: /renovar permissão/i,
    });
    // getAllByText: o próprio Radix Select espelha o valor também num
    // <select> nativo escondido (acessibilidade/autofill) -- o texto
    // aparece duas vezes no DOM por conta disso, não é um problema do
    // componente.
    expect(
      within(dialog).getAllByText(/modulo-antigo\.recurso-removido/).length,
    ).toBeGreaterThan(0);
  });

  it("não agrupa concessões distintas feitas no mesmo minuto", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar" }),
    ]);

    renderTela();

    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    expect(tabela.getAllByText("Fernanda Lima")).toHaveLength(2);
    expect(tabela.getByText("Visualizar")).toBeInTheDocument();
    expect(tabela.getByText("Editar")).toBeInTheDocument();
    expect(tabela.getAllByRole("button", { name: "Revogar" })).toHaveLength(2);
  });

  it("ordena por 'Concedido' do mais recente pro mais antigo", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({
        id: 1,
        acao: "visualizar",
        created_at: "2026-01-10T10:00:00Z",
      }),
      permissaoBase({
        id: 2,
        acao: "editar",
        created_at: "2026-01-20T10:00:00Z",
      }),
      permissaoBase({
        id: 3,
        acao: "aprovar",
        created_at: "2026-01-15T10:00:00Z",
      }),
    ]);

    renderTela();

    const tabela = await screen.findByRole("table", {
      name: /permissões individuais/i,
    });
    const linhas = within(tabela).getAllByRole("row").slice(1); // pula o cabeçalho
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      expect.stringContaining("Editar"), // created_at mais recente (20/01)
      expect.stringContaining("Aprovar"), // 15/01
      expect.stringContaining("Visualizar"), // mais antiga (10/01)
    ]);
  });

  it("revoga somente o ID da linha escolhida", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar" }),
    ]);
    vi.mocked(revogarPermissao).mockResolvedValue(
      permissaoBase({ ativo: false }),
    );
    const user = userEvent.setup();

    renderTela();
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    const linhaVisualizar = tabela.getByText("Visualizar").closest("tr");
    expect(linhaVisualizar).not.toBeNull();
    await user.click(
      within(linhaVisualizar!).getByRole("button", { name: "Revogar" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revogar" }));

    await waitFor(() => {
      expect(revogarPermissao).toHaveBeenCalledTimes(1);
    });
    expect(revogarPermissao).toHaveBeenCalledWith(1);
    expect(revogarPermissao).not.toHaveBeenCalledWith(2);
  });

  it("revoga uma permissão ativa", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);
    vi.mocked(revogarPermissao).mockResolvedValue(
      permissaoBase({ ativo: false }),
    );
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

    await user.click(
      screen.getByRole("button", { name: /expandir permissões individuais/i }),
    );

    expect(secaoUsuarios).toHaveClass("hidden");
    expect(secaoPermissoes).not.toHaveClass("hidden");

    await user.click(
      screen.getByRole("button", { name: /recolher permissões individuais/i }),
    );

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

  it("filtra 'Permissões individuais' por status", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar", ativo: false }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Visualizar")).toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Status"));
    await user.click(await screen.findByRole("option", { name: "Revogada" }));

    expect(screen.queryByText("Visualizar")).not.toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();
  });

  it("filtra 'Permissões individuais' por pessoa", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, usuario: USUARIO.id, acao: "visualizar" }),
      permissaoBase({ id: 2, usuario: ADMIN_CONCEDENTE.id, acao: "editar" }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Visualizar")).toBeInTheDocument();

    // Multi-seleção (Popover + Checkbox, não um Select comum) -- clica no
    // checkbox pelo role, não pelo texto "Nathalya Admin" (esse texto
    // também aparece na coluna "Concedido" da tabela, então getByText
    // bateria em mais de um elemento).
    await user.click(screen.getByLabelText("Pessoa"));
    await user.click(
      await screen.findByRole("checkbox", { name: "Nathalya Admin" }),
    );

    expect(screen.queryByText("Visualizar")).not.toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();
  });

  it("permite selecionar mais de uma pessoa no filtro", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, usuario: USUARIO.id, acao: "visualizar" }),
      permissaoBase({ id: 2, usuario: ADMIN_CONCEDENTE.id, acao: "editar" }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Visualizar")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Pessoa"));
    await user.click(
      await screen.findByRole("checkbox", { name: "Fernanda Lima" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Nathalya Admin" }));

    // as duas continuam visíveis -- filtro é "Fernanda OU Nathalya", não
    // "só a última marcada".
    expect(screen.getByText("Visualizar")).toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();
  });

  it("só lista no filtro de pessoa quem tem alguma permissão", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockResolvedValue([USUARIO, ADMIN_CONCEDENTE]);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ usuario: USUARIO.id }),
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText("Pessoa"));

    expect(
      await screen.findByRole("checkbox", { name: "Fernanda Lima" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Nathalya Admin" }),
    ).not.toBeInTheDocument();
  });

  it("filtra 'Permissões individuais' por ação", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, acao: "visualizar" }),
      permissaoBase({ id: 2, acao: "editar", data_fim: null }),
    ]);
    const user = userEvent.setup();

    renderTela();
    expect(await screen.findByText("Visualizar")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Ação"));
    await user.click(await screen.findByRole("option", { name: "Editar" }));

    // Escopado à tabela: depois de escolher "Editar" no filtro, o próprio
    // select passa a exibir "Editar" como valor selecionado -- sem
    // escopar, "Editar" bate duas vezes (select + célula da tabela).
    const tabela = within(
      screen.getByRole("table", { name: /permissões individuais/i }),
    );
    expect(tabela.queryByText("Visualizar")).not.toBeInTheDocument();
    expect(tabela.getByText("Editar")).toBeInTheDocument();
  });

  it("mostra mensagem e permite limpar quando os filtros não encontram nada", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ acao: "visualizar" }),
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText("Ação"));
    await user.click(await screen.findByRole("option", { name: "Editar" }));

    expect(
      await screen.findByText(
        "Nenhuma permissão encontrada com esses filtros.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /limpar filtros/i }));

    expect(await screen.findByText("Visualizar")).toBeInTheDocument();
  });

  // STC-415: seção nova, selecionável ao lado do conteúdo que já existia.
  it("mostra o catálogo de Legalização ao trocar de seção, sem desmontar 'Usuários'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    const secaoUsuarios = await screen.findByTestId("secao-usuarios");
    expect(secaoUsuarios).not.toHaveClass("hidden");

    await user.click(await screen.findByLabelText("Seção"));
    await user.click(
      await screen.findByRole("option", { name: "Catálogo de Legalização" }),
    );

    expect(await screen.findByText("Tipos de documento")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastrar documento na unidade"),
    ).toBeInTheDocument();
    expect(screen.getByText("Corrigir regra existente")).toBeInTheDocument();
    // "hidden" (não desmontado) -- mesmo padrão já usado por secaoExpandida.
    expect(secaoUsuarios.parentElement).toHaveAttribute("hidden");

    await user.click(screen.getByLabelText("Seção"));
    await user.click(await screen.findByRole("option", { name: "Usuários" }));
    expect(secaoUsuarios.parentElement).not.toHaveAttribute("hidden");
  });

  // Achado na revisão de código: essa aba desmontava ao trocar de seção
  // (render condicional) diferente da aba "Usuários" (só escondida) --
  // qualquer seleção/filtro em andamento ali era descartado sem aviso ao
  // voltar.
  it("não perde a seleção de unidade em 'Corrigir regra' ao trocar de seção e voltar", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText("Seção"));
    await user.click(
      await screen.findByRole("option", { name: "Catálogo de Legalização" }),
    );

    await user.click(await screen.findByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    expect(screen.getByLabelText("Unidade")).toHaveTextContent("Niterói");

    await user.click(screen.getByLabelText("Seção"));
    await user.click(await screen.findByRole("option", { name: "Usuários" }));
    await user.click(screen.getByLabelText("Seção"));
    await user.click(
      await screen.findByRole("option", { name: "Catálogo de Legalização" }),
    );

    expect(screen.getByLabelText("Unidade")).toHaveTextContent("Niterói");
  });
});
