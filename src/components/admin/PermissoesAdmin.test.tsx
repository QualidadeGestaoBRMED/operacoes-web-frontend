import { useSyncExternalStore } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatarDataHora } from "@/lib/utils";
import type { Modulo, PermissaoUsuario, Unidade, Usuario } from "@/types";
import { PermissoesAdmin } from "./PermissoesAdmin";

// STC-519: PermissoesAdmin agora lê usePathname() direto (não mais um prop
// abaInicial) -- pra não precisar de rerender() manual em todo teste que já
// existia (vários assumem que trocar de Seção pelo Select já reflete na
// tela na mesma interação, síncrono), o mock precisa ser reativo de
// verdade, não só uma função pura lendo uma variável -- useSyncExternalStore
// com um pub-sub mínimo imita o próprio mecanismo que o usePathname() real
// do Next.js usa por baixo. Nomes com prefixo "mock" de propósito -- é o
// que o Vitest exige pra permitir referenciar essas variáveis de dentro de
// um vi.mock hoisted.
let mockPathnameValor = "/admin/permissoes";
const mockPathnameOuvintes = new Set<() => void>();
function mockSetPathname(novoValor: string) {
  mockPathnameValor = novoValor;
  mockPathnameOuvintes.forEach((ouvinte) => ouvinte());
}
const replace = vi.fn((url: string) => {
  mockSetPathname(url);
});
// Testes de férias: chave ligada (STC-687 desliga em produção nesta fase).
vi.mock("@/config/gestaoRH", () => ({ FERIAS_ATIVA: true }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () =>
    useSyncExternalStore(
      (aoMudar) => {
        mockPathnameOuvintes.add(aoMudar);
        return () => mockPathnameOuvintes.delete(aoMudar);
      },
      () => mockPathnameValor,
    ),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
vi.mock("@/lib/plataforma");
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/gestaoRH", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRH")>()),
  buscarParametrosAbsenteismo: vi.fn(),
  buscarReguaFerias: vi.fn(),
  listarEquipesVR: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/gestaoRHImportacao", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHImportacao")>()),
  listarImportacoes: vi.fn().mockResolvedValue([]),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { listarDocumentosLegalizacao } from "@/lib/legalizacao";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
import { buscarParametrosAbsenteismo, buscarReguaFerias, listarEquipesVR } from "@/lib/gestaoRH";
import {
  listarAcessos,
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
  rede: "padrao",
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

// STC-519: aba vem do pathname -- testes que simulam o atalho da
// sidebar/rota do Catálogo chamam mockSetPathname() antes de renderTela(),
// em vez de passar prop ou mockar query string.
function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <PermissoesAdmin />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSetPathname("/admin/permissoes");
  replace.mockImplementation((url: string) => {
    mockSetPathname(url);
  });
  vi.mocked(listarUsuarios).mockResolvedValue([USUARIO, ADMIN_CONCEDENTE]);
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE_NITEROI]);
  vi.mocked(listarSetores).mockResolvedValue([]);
  vi.mocked(listarPermissoes).mockResolvedValue([]);
  vi.mocked(listarModulos).mockResolvedValue([MODULO_GESTAO_DEMANDAS]);
  vi.mocked(listarPerfis).mockResolvedValue([]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue({
    vigente: {
      id: 1,
      limite_atraso_minutos: 15,
      tipos_computados: ["falta", "atestado"],
      meta_percentual: null,
      faixas: null,
      janela_avaliacao: null,
      vigente_a_partir_de: "2000-01-01",
      salvo_por: null,
      versao_inicial: true,
      created_at: "2026-10-05T10:00:00Z",
    },
    versoes: [],
  });
  vi.mocked(buscarReguaFerias).mockResolvedValue({ marcos: [], versoes: [] });
});


// useAuth simulado: completa o que a STC-747 acrescentou (redes
// administradas e o usuário logado) a partir de isAdminOps/isAdminQG.
function simularAuth(valores: Partial<ReturnType<typeof useAuth>>) {
  const admin = valores.isAdminOps ?? false;
  const redes =
    valores.redesAdministradas ??
    (admin ? (valores.isAdminQG ? (["opex", "padrao"] as const) : (["padrao"] as const)) : []);
  vi.mocked(useAuth).mockReturnValue({
    user: admin
      ? {
          usuarioId: 999,
          perfil: { id: 999, nome: "Admin", descricao: "", nivel: valores.isAdminQG ? 1 : 2 },
          redes_administradas: [...redes],
        }
      : undefined,
    redesAdministradas: [...redes],
    administraRedePadrao: redes.includes("padrao"),
    administraAsDuasRedes: redes.length === 2,
    ...valores,
  } as ReturnType<typeof useAuth>);
}

describe("PermissoesAdmin (STC-266)", () => {
  it("redireciona quem não é admin", async () => {
    simularAuth({
      isAdminOps: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/modulos/gestao-demandas");
    });
  });

  it("STC-763: não redireciona enquanto o cargo atual não chega", () => {
    // Quem acabou de virar Admin ainda tem o cargo antigo na sessão.
    simularAuth({
      isAdminOps: false,
      isLoading: false,
      confirmandoCargo: true,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(replace).not.toHaveBeenCalled();
  });

  it("não redireciona enquanto a sessão ainda está carregando", () => {
    simularAuth({
      isAdminOps: false,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(replace).not.toHaveBeenCalled();
  });

  // STC-514: Coordenador ganha acesso, mas só ao Catálogo de Legalização.
  it("Coordenador não é redirecionado, mas só vê o Catálogo de Legalização (sem Select de seção, sem Usuários/Permissões)", async () => {
    simularAuth({
      isAdminOps: false,
      isCoordenacaoUnidade: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(replace).not.toHaveBeenCalledWith("/modulos/gestao-demandas");
    expect(
      await screen.findByRole("heading", { name: "Catálogo de Legalização" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Seção")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /permissões individuais/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("secao-usuarios")).not.toBeInTheDocument();
  });

  it("Coordenador não vê os Parâmetros de Gestão RH, nem pela rota própria", async () => {
    mockSetPathname("/admin/permissoes/parametros-gestao-rh");
    simularAuth({
      isAdminOps: false,
      isCoordenacaoUnidade: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(
      await screen.findByRole("heading", { name: "Catálogo de Legalização" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Parâmetros de absenteísmo" }),
    ).not.toBeInTheDocument();
    expect(buscarParametrosAbsenteismo).not.toHaveBeenCalled();
    // Nem a aba Equipes, que lista e reclassifica as equipes do VR.
    expect(screen.queryByRole("tab", { name: "Equipes" })).not.toBeInTheDocument();
    expect(listarEquipesVR).not.toHaveBeenCalled();
  });

  // STC-521: Setor de Legalização (nível 4, setor.codigo === "LEG") ganha o
  // mesmo acesso restrito que o Coordenador já tinha -- mesmo motivo (já
  // pode escrever no catálogo pela API, faltava o caminho na tela).
  it("Setor de Legalização não é redirecionado, mas só vê o Catálogo de Legalização (sem Select de seção, sem Usuários/Permissões)", async () => {
    simularAuth({
      isAdminOps: false,
      isCoordenacaoUnidade: false,
      isSetorLeg: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(replace).not.toHaveBeenCalledWith("/modulos/gestao-demandas");
    expect(
      await screen.findByRole("heading", { name: "Catálogo de Legalização" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Seção")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /permissões individuais/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("secao-usuarios")).not.toBeInTheDocument();
  });

  // STC-760: a rota de permissões é só de Admin Operações; buscá-la para
  // quem entra só pelo Catálogo gerava 403 repetido (o SWR tenta de novo).
  it.each([
    ["Coordenador", { isCoordenacaoUnidade: true }],
    ["Setor de Legalização", { isSetorLeg: true }],
  ])("%s no Catálogo não busca as permissões de usuário", async (_perfil, papel) => {
    simularAuth({
      isAdminOps: false,
      isLoading: false,
      ...papel,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(
      await screen.findByRole("heading", { name: "Catálogo de Legalização" }),
    ).toBeInTheDocument();
    expect(listarPermissoes).not.toHaveBeenCalled();
  });

  it("Admin Operações busca as permissões de usuário", async () => {
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    await waitFor(() => expect(listarPermissoes).toHaveBeenCalled());
  });

  // STC-521: nível 4 sozinho não basta -- existem outros setores no mesmo
  // nível (RH etc.). Só isSetorLeg (nível + setor.codigo === "LEG") libera
  // acesso; qualquer outro setor de nível 4 continua sem nenhum.
  it("usuário de nível Setor mas de outro setor (não Legalização) continua sem acesso", async () => {
    simularAuth({
      isAdminOps: false,
      isCoordenacaoUnidade: false,
      isSetorLeg: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/modulos/gestao-demandas");
    });
  });

  // STC-519: /admin/permissoes/catalogo-legalizacao (rota própria, ver
  // layout.tsx) -- PermissoesAdmin lê o pathname direto (usePathname()),
  // não um prop, pra saber que deve abrir no Catálogo. Sem isso, Admin
  // caía sempre na aba "Usuários" (só o Coordenador tinha a aba forçada,
  // via apenasCatalogo).
  it("na rota /admin/permissoes/catalogo-legalizacao, abre direto no Catálogo de Legalização", async () => {
    mockSetPathname("/admin/permissoes/catalogo-legalizacao");
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    // Admin sempre vê "Administração" como título da página (diferente do
    // Coordenador, apenasCatalogo troca esse h1) -- o que muda é o Select
    // "Seção" já vir com "Catálogo de Legalização" selecionado, mostrando
    // o conteúdo do catálogo (ex. "Tipos de documento") em vez de "Usuários".
    expect(
      await screen.findByLabelText("Seção"),
    ).toHaveTextContent("Catálogo de Legalização");
    expect(
      await screen.findByRole("heading", { name: "Tipos de documento" }),
    ).toBeInTheDocument();
  });

  it("na rota /admin/permissoes/parametros-gestao-rh, Admin abre direto nos Parâmetros de Gestão RH", async () => {
    mockSetPathname("/admin/permissoes/parametros-gestao-rh");
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(await screen.findByLabelText("Seção")).toHaveTextContent("Parâmetros de Gestão RH");
    expect(
      await screen.findByRole("heading", { name: "Parâmetros de absenteísmo" }),
    ).toBeVisible();
    expect(screen.getByTestId("secao-usuarios").closest("[hidden]")).not.toBeNull();
  });

  it("STC-746: Admin chega aos Acessos pelo Select de seção, que só busca na primeira visita", async () => {
    vi.mocked(listarAcessos).mockResolvedValue({
      periodo: { inicio: "2026-09-20", fim: "2026-10-19" },
      hoje: "2026-10-19",
      usuarios: [],
    });
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText("Seção"));
    expect(listarAcessos).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("option", { name: "Acessos" }));

    expect(replace).toHaveBeenCalledWith("/admin/permissoes/acessos");
    expect(await screen.findByRole("heading", { name: "Acessos" })).toBeVisible();
    await waitFor(() => expect(listarAcessos).toHaveBeenCalled());
    expect(screen.getByTestId("secao-usuarios").closest("[hidden]")).not.toBeNull();
  });

  it("Admin chega aos Parâmetros de Gestão RH pelo Select de seção", async () => {
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByLabelText("Seção"));
    // Entrar na Administração não busca os parâmetros: só a visita à seção.
    expect(buscarParametrosAbsenteismo).not.toHaveBeenCalled();
    expect(buscarReguaFerias).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("option", { name: "Parâmetros de Gestão RH" }));

    expect(replace).toHaveBeenCalledWith("/admin/permissoes/parametros-gestao-rh");
    expect(await screen.findByLabelText("Seção")).toHaveTextContent("Parâmetros de Gestão RH");
    await waitFor(() => expect(buscarParametrosAbsenteismo).toHaveBeenCalled());
    expect(buscarReguaFerias).toHaveBeenCalled();
  });

  it("STC-747/STC-746: Admin Operações Especiais fica com Usuários e Acessos, mesmo pela rota dos Parâmetros", async () => {
    mockSetPathname("/admin/permissoes/parametros-gestao-rh");
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
      redesAdministradas: ["opex"],
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    const secao = await screen.findByLabelText("Seção");
    expect(secao).toHaveTextContent("Usuários");
    await user.click(secao);

    expect(screen.getAllByRole("option").map((opcao) => opcao.textContent)).toEqual([
      "Usuários",
      "Acessos",
    ]);
    expect(buscarParametrosAbsenteismo).not.toHaveBeenCalled();
    // A URL sai da aba proibida.
    expect(replace).toHaveBeenCalledWith("/admin/permissoes");
  });

  it("STC-763: aba fora do acesso pela sessão espera o cargo atual, sem mostrar outra aba", async () => {
    mockSetPathname("/admin/permissoes/parametros-gestao-rh");
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
      redesAdministradas: ["opex"],
      confirmandoCargo: true,
    } as ReturnType<typeof useAuth>);

    renderTela();

    await waitFor(() => expect(screen.queryByLabelText("Seção")).not.toBeInTheDocument());
    expect(screen.queryByTestId("secao-usuarios")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("na rota /admin/permissoes (padrão), continua abrindo na aba 'Usuários'", async () => {
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderTela();

    expect(await screen.findByLabelText("Seção")).toHaveTextContent("Usuários");
  });

  // STC-519 (achado em revisão de falhas críticas): trocar a Seção pelo
  // Select troca o conteúdo, mas sem navegar a URL ficava parada -- a
  // sidebar (componente separado, destaca pelo pathname) continuava
  // marcando "Catálogo de Legalização" como página atual mesmo com
  // Usuários na tela. router.replace() mantém a URL sincronizada com o
  // que está de fato exibido.
  it("trocar a Seção pelo Select navega de verdade (mantém a URL sincronizada com o conteúdo)", async () => {
    mockSetPathname("/admin/permissoes/catalogo-legalizacao");
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await screen.findByRole("heading", { name: "Tipos de documento" });

    await user.click(screen.getByLabelText("Seção"));
    await user.click(await screen.findByRole("option", { name: "Usuários" }));

    expect(replace).toHaveBeenCalledWith("/admin/permissoes");

    replace.mockClear();
    await user.click(screen.getByLabelText("Seção"));
    await user.click(
      await screen.findByRole("option", { name: "Catálogo de Legalização" }),
    );

    expect(replace).toHaveBeenCalledWith("/admin/permissoes/catalogo-legalizacao");
  });

  // STC-519 (achado em 3ª rodada de revisão de falhas críticas): a correção
  // anterior (rota própria por aba) resolvia o destaque da sidebar, mas
  // navegar entre /admin/permissoes e .../catalogo-legalizacao remontava
  // PermissoesAdmin inteiro (cada rota tinha seu próprio page.tsx),
  // perdendo filtros/seção expandida/diálogos abertos a cada troca de
  // Seção. PermissoesAdmin passou a viver no layout.tsx (persiste entre as
  // duas rotas, nunca remonta) -- este teste prova que o achado foi
  // corrigido: um estado local (seção "Permissões individuais" expandida)
  // sobrevive a ida e volta entre as duas abas.
  it("trocar de aba pelo Select preserva outro state local (ex. seção expandida) -- não remonta o componente", async () => {
    simularAuth({
      isAdminOps: true,
      isCoordenacaoUnidade: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const user = userEvent.setup();

    renderTela();
    await screen.findByLabelText("Seção");
    await user.click(
      screen.getByRole("button", { name: "Expandir Permissões individuais" }),
    );
    expect(
      screen.getByRole("button", { name: "Recolher Permissões individuais" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Seção"));
    await user.click(
      await screen.findByRole("option", { name: "Catálogo de Legalização" }),
    );
    await screen.findByRole("heading", { name: "Tipos de documento" });

    await user.click(screen.getByLabelText("Seção"));
    await user.click(await screen.findByRole("option", { name: "Usuários" }));

    expect(
      await screen.findByRole("button", { name: "Recolher Permissões individuais" }),
    ).toBeInTheDocument();
  });

  it("lista permissões existentes com nome resolvido e status", async () => {
    simularAuth({
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
    simularAuth({
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
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ ativo: false }),
    ]);

    renderTela();

    expect(await screen.findByText("Revogada")).toBeInTheDocument();
  });

  it("STC-747: enquanto pessoas e unidades carregam, o campo Pessoa espera", async () => {
    simularAuth({ isAdminOps: true, isLoading: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarUnidades).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: /nova permissão/i }));
    const dialog = await screen.findByRole("dialog");

    const pessoa = within(dialog).getByLabelText(/pessoa/i);
    expect(pessoa).toBeDisabled();
    expect(pessoa).toHaveTextContent("Carregando...");
  });

  it("STC-747: falha ao carregar as pessoas avisa no formulário", async () => {
    simularAuth({ isAdminOps: true, isLoading: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarUsuarios).mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();

    renderTela();
    await user.click(await screen.findByRole("button", { name: /nova permissão/i }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("Não foi possível carregar as pessoas -- tente novamente."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/pessoa/i)).toBeDisabled();
  });

  it("cria uma nova permissão com o payload certo", async () => {
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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

  it("STC-422: bloqueia o submit e avisa quando o recurso escolhido não suporta nenhuma ação deste formulário (4º achado no code review)", async () => {
    // Achado no code review: um recurso real (não hipotético -- é
    // exatamente o "recurso novo cadastrado no backend" que a issue
    // promete suportar sem PR de frontend) pode não ter nenhuma interseção
    // com visualizar/editar (ex.: só suporta "configurar"). Sem bloqueio, o
    // Select de Ação ficava vazio mas o valor padrão ("visualizar")
    // sobrevivia por baixo e ia pro submit como se fosse suportado.
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      {
        ...MODULO_GESTAO_DEMANDAS,
        recursos_permissao: [
          {
            id: 3,
            chave: "gestao-demandas.configuracoes",
            rotulo: "Configurações",
            acoes_suportadas: ["configurar"],
          },
        ],
      },
    ]);
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(
      await screen.findByRole("option", { name: /configurações/i }),
    );

    expect(
      within(dialog).getByText(
        /não suporta nenhuma ação que este formulário pode conceder/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /conceder permissão/i }),
    ).toBeDisabled();
    expect(criarPermissao).not.toHaveBeenCalled();
  });

  it("STC-422: um recurso sem acoes_suportadas não derruba a página (achado numa 6ª rodada de code review)", async () => {
    // Mesma classe de falha do teste abaixo (Modulo sem recursos_permissao),
    // agora um nível mais fundo: acoes_suportadas é obrigatório só pro
    // TypeScript, listarModulos() não valida a resposta em runtime. Cast
    // forçado de propósito, simulando o contrato quebrado.
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      {
        ...MODULO_GESTAO_DEMANDAS,
        recursos_permissao: [
          {
            id: 3,
            chave: "gestao-demandas.configuracoes",
            rotulo: "Configurações",
            acoes_suportadas: undefined,
          },
        ],
      },
    ] as unknown as Modulo[]);
    const user = userEvent.setup();

    renderTela();
    await user.click(
      await screen.findByRole("button", { name: /nova permissão/i }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText(/recurso/i));
    // Selecionar o recurso é o que dispara o acesso a
    // recursoAtual.acoes_suportadas (cálculo de acoesDisponiveis) -- sem a
    // guarda, `.includes` num `undefined` derruba a página inteira aqui.
    await user.click(
      await screen.findByRole("option", { name: /configurações/i }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /não suporta nenhuma ação que este formulário pode conceder/i,
      ),
    ).toBeInTheDocument();
  });

  it("STC-422: um Modulo sem recursos_permissao não derruba a página (achado no code review)", async () => {
    // recursos_permissao é sempre presente no contrato real (ModuloSerializer
    // sempre serializa a lista, mesmo vazia), mas nada garante isso em
    // runtime -- uma resposta em cache de uma versão anterior do backend,
    // por exemplo. Cast forçado de propósito: simula exatamente esse
    // contrato quebrado, que TypeScript sozinho não pega (só existe em
    // runtime, não em compile-time).
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    // guardava essa chave por baixo.
    simularAuth({
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

  it("STC-747: global de uma rede mostra a rede e continua dela ao renovar", async () => {
    simularAuth({ isAdminOps: true, isAdminQG: true, isLoading: false } as ReturnType<
      typeof useAuth
    >);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({
        ativo: false,
        data_fim: "2026-01-15",
        escopo_tipo: "global",
        unidade: null,
        rede: "padrao",
      }),
    ]);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    expect(await tabela.findByText(/rede própria/)).toBeInTheDocument();

    await user.click(await tabela.findByRole("button", { name: "Reativar" }));
    const dialog = await screen.findByRole("dialog", { name: /renovar permissão/i });
    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");
    await user.click(within(dialog).getByRole("button", { name: /renovar permissão/i }));

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({ escopo_tipo: "global", rede: "padrao" }),
      );
    });
  });

  it("STC-422: Renovar sem tocar em Recurso continua resolvendo o módulo mesmo quando o recurso saiu do catálogo (2º achado no code review)", async () => {
    // Achado no code review: a checagem visual acima (achado 1) resolvia só
    // a aparência -- o campo "recurso" continuava com a chave órfã, e
    // encontrarRecursoPorChave() não acha nada pra ela no catálogo atual.
    // Sem um fallback, moduloId caía em null no submit, mesmo o módulo
    // "modulo-antigo" continuando a existir (só aquele recurso específico é
    // que não está mais listado nele) -- reativar sem tocar no campo
    // Recurso (o próprio caso de uso do botão) perdia a associação de
    // módulo da permissão em silêncio.
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([
      MODULO_GESTAO_DEMANDAS,
      {
        id: 9,
        nome: "Módulo Antigo",
        codigo: "modulo-antigo",
        descricao: "",
        status: "ativo",
        versao: "0.1.0",
        recursos_permissao: [],
      },
    ]);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({
        ativo: false,
        data_fim: "2026-01-15",
        recurso: "modulo-antigo.recurso-removido",
      }),
    ]);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const user = userEvent.setup();

    renderTela();
    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    await user.click(await tabela.findByRole("button", { name: "Reativar" }));
    const dialog = await screen.findByRole("dialog", {
      name: /renovar permissão/i,
    });

    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");
    await user.click(
      within(dialog).getByRole("button", { name: /renovar permissão/i }),
    );

    await waitFor(() => {
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({
          recurso: "modulo-antigo.recurso-removido",
          modulo: 9,
        }),
      );
    });
  });

  it("STC-422: não mostra 'recurso órfão' nem permite submeter enquanto o catálogo de módulos ainda está carregando (3º achado no code review)", async () => {
    // Achado no code review: recursos=[] durante o carregamento do catálogo
    // é visualmente idêntico a "recurso removido de verdade" -- sem
    // distinguir os dois estados, Renovar numa permissão com um recurso
    // perfeitamente válido ("gestao-demandas.kanban") mostrava o aviso
    // falso "não está mais no catálogo" só porque o fetch de módulos ainda
    // não tinha respondido, e submeter nessa janela perdia o módulo
    // (mesmo defeito do achado anterior, só que causado por timing, não
    // por remoção real).
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    let resolverModulos: (modulos: Modulo[]) => void = () => {};
    vi.mocked(listarModulos).mockReturnValue(
      new Promise((resolve) => {
        resolverModulos = resolve;
      }),
    );
    vi.mocked(listarPermissoes).mockResolvedValue([
      // recurso válido de propósito (o mesmo usado em permissaoBase()) --
      // "gestao-demandas.kanban" continua existindo no catálogo, só o
      // fetch é que ainda não voltou.
      permissaoBase({ ativo: false, data_fim: "2026-01-15" }),
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

    // Catálogo ainda pendente: nem o aviso de órfão, nem o botão liberado.
    expect(
      within(dialog).queryByText(/não está mais no catálogo/i),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /renovar permissão/i }),
    ).toBeDisabled();

    resolverModulos([MODULO_GESTAO_DEMANDAS]);

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: /renovar permissão/i }),
      ).not.toBeDisabled();
    });
    expect(
      within(dialog).queryByText(/não está mais no catálogo/i),
    ).not.toBeInTheDocument();
  });

  it("STC-422: não mostra 'recurso órfão' nem permite submeter quando o catálogo de módulos falha ao carregar (5º achado no code review)", async () => {
    // Achado no code review: só isLoading era considerado -- quando o fetch
    // de módulos termina em erro (timeout, 5xx), o SWR volta isLoading:
    // false com data undefined, deixando recursos/modulos em [] de forma
    // *permanente* (não só durante uma janela curta de carregamento) -- o
    // mesmo estado que o código tratava como "carregado com sucesso e
    // vazio". Sem tratar o erro, Renovar numa permissão com um recurso
    // perfeitamente válido mostrava o aviso falso "não está mais no
    // catálogo" e liberava o submit, perdendo o módulo (modulo: null).
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockRejectedValue(new Error("falha de rede"));
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ ativo: false, data_fim: "2026-01-15" }),
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

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: /renovar permissão/i }),
      ).toBeDisabled();
    });
    expect(
      within(dialog).queryByText(/não está mais no catálogo/i),
    ).not.toBeInTheDocument();
    expect(criarPermissao).not.toHaveBeenCalled();
  });

  it("não agrupa concessões distintas feitas no mesmo minuto", async () => {
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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
    simularAuth({
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

  // STC-505 (achado no code review): nada garantia que o ramo mobile
  // (ehMobile) continuasse sem altura travada -- ver PermissoesAdmin.tsx pro
  // racional completo (ehMobile ? undefined : {maxHeight}).
  it("no mobile, o container de 'Permissões individuais' não trava a própria altura", async () => {
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);

    renderTela();

    const tabela = await screen.findByRole("table", {
      name: /permissões individuais/i,
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
  // Escopado à tabela: "Pessoa"/"Fernanda Lima" também existem na tabela de
  // Perfil/Unidade/Setor, mesma página.
  it("mantém a coluna 'Pessoa' fixa (sticky left-0) em 'Permissões individuais' ao rolar horizontalmente", async () => {
    simularAuth({
      isAdminOps: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([permissaoBase()]);

    renderTela();

    const tabela = within(
      await screen.findByRole("table", { name: /permissões individuais/i }),
    );
    const cabecalho = tabela.getByRole("columnheader", { name: "Pessoa" });
    expect(cabecalho).toHaveClass("sticky", "left-0");

    const celula = tabela.getByRole("cell", { name: "Fernanda Lima" });
    expect(celula).toHaveClass("sticky", "left-0");
  });
});

describe("PermissoesAdmin -- redes (STC-747)", () => {
  async function abrirFormularioGlobal() {
    const user = userEvent.setup();
    renderTela();
    await user.click(await screen.findByRole("button", { name: /nova permissão/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText(/pessoa/i));
    await user.click(await screen.findByRole("option", { name: "Fernanda Lima" }));
    await user.click(within(dialog).getByLabelText(/recurso/i));
    await user.click(await screen.findByRole("option", { name: /kanban/i }));
    await user.click(within(dialog).getByLabelText(/escopo/i));
    await user.click(await screen.findByRole("option", { name: /global/i }));
    const campoInicio = within(dialog).getByLabelText(/início/i);
    await user.clear(campoInicio);
    await user.type(campoInicio, "2026-03-01");
    return { user, dialog };
  }

  it("Admin Operações Especiais só tem a aba Usuários", async () => {
    simularAuth({
      isAdminOps: true,
      isLoading: false,
      redesAdministradas: ["opex"],
    } as ReturnType<typeof useAuth>);
    mockSetPathname("/admin/permissoes/catalogo-legalizacao");
    const user = userEvent.setup();

    renderTela();

    expect(await screen.findByTestId("secao-usuarios")).toBeVisible();
    await user.click(screen.getByLabelText("Seção"));
    expect(await screen.findByRole("option", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Catálogo de Legalização" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Parâmetros de Gestão RH" })).not.toBeInTheDocument();
  });

  it("Admin de uma rede concede global da rede dele, sem escolher", async () => {
    simularAuth({ isAdminOps: true, isLoading: false } as ReturnType<typeof useAuth>);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const { user, dialog } = await abrirFormularioGlobal();

    expect(within(dialog).getByText("Cobre as unidades da rede própria.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Rede")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /conceder permissão/i }));

    await waitFor(() => expect(criarPermissao).toHaveBeenCalled());
    // Sem rede no envio: o backend usa a rede de quem concede.
    expect(vi.mocked(criarPermissao).mock.calls[0][0]).not.toHaveProperty("rede");
  });

  it("quem administra as duas concede global das duas redes com rede null", async () => {
    simularAuth({ isAdminOps: true, isAdminQG: true, isLoading: false } as ReturnType<
      typeof useAuth
    >);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const { user, dialog } = await abrirFormularioGlobal();

    expect(within(dialog).getByLabelText("Rede")).toHaveTextContent("As duas redes");
    await user.click(within(dialog).getByRole("button", { name: /conceder permissão/i }));

    await waitFor(() =>
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({ escopo_tipo: "global", rede: null }),
      ),
    );
  });

  it("quem administra as duas escolhe a rede do global", async () => {
    simularAuth({ isAdminOps: true, isAdminQG: true, isLoading: false } as ReturnType<
      typeof useAuth
    >);
    vi.mocked(criarPermissao).mockResolvedValue(permissaoBase());
    const { user, dialog } = await abrirFormularioGlobal();

    await user.click(within(dialog).getByLabelText("Rede"));
    await user.click(await screen.findByRole("option", { name: "Operações Especiais" }));
    await user.click(within(dialog).getByRole("button", { name: /conceder permissão/i }));

    await waitFor(() =>
      expect(criarPermissao).toHaveBeenCalledWith(
        expect.objectContaining({ escopo_tipo: "global", rede: "opex" }),
      ),
    );
  });
});

describe("PermissoesAdmin -- ordenação das permissões individuais (STC-794)", () => {
  it("Concedido: crescente, decrescente e de volta à ordem padrão (status, depois mais recente)", async () => {
    simularAuth({ isAdminOps: true, isLoading: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 1, created_at: "2026-01-15T14:30:00Z" }),
      permissaoBase({ id: 2, ativo: false, created_at: "2026-03-01T10:00:00Z" }),
      // A agendada foi concedida antes de todas: a ordem por data difere da padrão.
      permissaoBase({ id: 3, data_inicio: "2099-01-01", created_at: "2026-01-01T10:00:00Z" }),
    ]);
    const user = userEvent.setup();

    renderTela();
    const tabela = await screen.findByRole("table", { name: "Permissões individuais" });
    await within(tabela).findByText("Revogada");
    const status = () =>
      within(tabela)
        .getAllByRole("row")
        .slice(1)
        .map((linha) => within(linha).getAllByRole("cell")[6].textContent);
    // Ordem padrão: Ativa, Agendada, Revogada.
    expect(status()).toEqual(["Ativa", "Agendada", "Revogada"]);
    const concedido = within(tabela).getByRole("button", { name: "Concedido" });

    await user.click(concedido);
    expect(status()).toEqual(["Agendada", "Ativa", "Revogada"]);
    expect(within(tabela).getByRole("columnheader", { name: "Concedido" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await user.click(concedido);
    expect(status()).toEqual(["Revogada", "Ativa", "Agendada"]);
    await user.click(concedido);
    expect(status()).toEqual(["Ativa", "Agendada", "Revogada"]);
    expect(within(tabela).getByRole("columnheader", { name: "Concedido" })).not.toHaveAttribute(
      "aria-sort",
    );
  });

  it("Status ordena na ordem dos status, não alfabética", async () => {
    simularAuth({ isAdminOps: true, isLoading: false } as ReturnType<typeof useAuth>);
    vi.mocked(listarPermissoes).mockResolvedValue([
      permissaoBase({ id: 2, data_inicio: "2099-01-01", created_at: "2026-03-01T10:00:00Z" }),
      permissaoBase({ id: 1, created_at: "2026-01-15T14:30:00Z" }),
    ]);
    const user = userEvent.setup();

    renderTela();
    const tabela = await screen.findByRole("table", { name: "Permissões individuais" });
    await within(tabela).findByText("Agendada");
    const coluna = within(tabela).getByRole("button", { name: "Status" });

    await user.click(coluna);
    await user.click(coluna);
    const status = within(tabela)
      .getAllByRole("row")
      .slice(1)
      .map((linha) => within(linha).getAllByRole("cell")[6].textContent);
    // Decrescente pela ordem dos status (Ativa, Agendada, ...): Agendada
    // primeiro. Em ordem alfabética decrescente, seria Ativa primeiro.
    expect(status).toEqual(["Agendada", "Ativa"]);
  });
});
