import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Modulo } from "@/types";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/modulos/gestao-demandas"),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/plataforma");

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { listarModulos } from "@/lib/plataforma";

function renderSidebar() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Sidebar />
    </SWRConfig>,
  );
}

function modulo(overrides: Partial<Modulo> = {}): Modulo {
  return {
    id: 1,
    nome: "Legalização",
    codigo: "legalizacao",
    descricao: "",
    status: "em_breve",
    versao: "0.1.0",
    recursos_permissao: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarModulos).mockResolvedValue([]);
  vi.mocked(usePathname).mockReturnValue("/modulos/gestao-demandas");
});

describe("Sidebar -- bloco Admin Q&G/Admin Operações (STC-262/STC-266)", () => {
  // vi.stubEnv não reverte sozinho (precisaria de unstubEnvs:true no
  // vitest.config.ts, que não está ligado) -- sem isso, o valor ficaria
  // vazando em process.env pra qualquer teste rodado depois deste, no
  // mesmo processo do Vitest.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não aparece nada pra quem não é admin", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Operações")).not.toBeInTheDocument();
  });

  // Achado no code review do Tech Lead: NEXT_PUBLIC_API_URL é inlined em
  // build time -- ausente/vazia nesse build, o link viraria "undefined/admin"
  // até o próximo deploy. vi.stubEnv com string vazia simula esse cenário
  // (o valor "não populado" real do Vitest, undefined, já está coberto
  // implicitamente por todo teste que não chama stubEnv). O link interno
  // (STC-266) não depende dessa env, então continua aparecendo.
  it("não mostra o link do Django Admin se NEXT_PUBLIC_API_URL estiver ausente, mesmo pra Admin Q&G", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: true,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
  });

  it("Admin Q&G vê os dois links: Django Admin e a tela interna", () => {
    // Achado escrevendo o teste: process.env.NEXT_PUBLIC_API_URL não é
    // populado pelo Vitest (só pelo build real do Next.js) -- sem
    // vi.stubEnv, os dois lados da comparação comparariam "undefined/admin"
    // contra "undefined/admin", um teste que passa sem provar nada.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.test");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: true,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    const linkDjango = screen.getByRole("link", { name: /admin q&g/i });
    expect(linkDjango).toHaveAttribute("href", "https://api.exemplo.test/admin");
    expect(linkDjango).toHaveAttribute("target", "_blank");
    expect(linkDjango).toHaveAttribute("rel", "noopener noreferrer");

    const linkInterno = screen.getByRole("link", { name: /administração/i });
    expect(linkInterno).toHaveAttribute("href", "/admin/permissoes");
  });

  // STC-266: Admin Operações (nível 2, não Q&G) não tem login no Django
  // Admin configurado -- só vê a tela interna, rotulada com o próprio
  // perfil em vez de "Administração" genérico.
  it("Admin Operações (não Q&G) vê só o link interno, rotulado como 'Admin Operações'", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /admin operações/i });
    expect(link).toHaveAttribute("href", "/admin/permissoes");
  });

  // STC-514: Coordenador (nível 3) não ganha este bloco -- o acesso dele ao
  // Catálogo de Legalização vive dentro do submenu de Legalização (ver
  // describe "submenu expansível de Legalização" mais abaixo), não aqui.
  it("Coordenador não vê nenhum link deste bloco (Admin Q&G/Administração/Admin Operações)", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    expect(screen.queryByText("Admin Q&G")).not.toBeInTheDocument();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Operações")).not.toBeInTheDocument();
  });
});

describe("Sidebar -- status do módulo lido pela API (STC-423)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
    } as ReturnType<typeof useAuth>);
  });

  it("Legalização aparece bloqueada quando Modulo.status é 'em_breve'", async () => {
    vi.mocked(listarModulos).mockResolvedValue([modulo({ status: "em_breve" })]);

    renderSidebar();
    // Espera a resolução de fato (não só o primeiro render, que já nasce
    // bloqueado por padrão antes do fetch responder) -- sem isto, o teste
    // passaria mesmo se a leitura de Modulo.status estivesse quebrada, já
    // que o estado inicial e o estado "em_breve" resolvido são idênticos na
    // tela. O teste seguinte ("status é 'ativo'") é quem prova de fato que
    // o hook reage ao dado resolvido, com um resultado diferente do padrão.
    await waitFor(() => expect(listarModulos).toHaveBeenCalledTimes(1));

    // Legalização some da lista de links reais e continua entre os itens
    // com badge "em breve" (não é o único ali -- os outros módulos do
    // roadmap, sem rota nenhuma, sempre ficam bloqueados também).
    await screen.findByText("Legalização");
    expect(
      screen.queryByRole("link", { name: /legalização/i }),
    ).not.toBeInTheDocument();
  });

  it("Legalização vira link real, pra /modulos/legalizacao, quando Modulo.status é 'ativo'", async () => {
    vi.mocked(listarModulos).mockResolvedValue([modulo({ status: "ativo" })]);

    renderSidebar();

    const link = await screen.findByRole("link", { name: /legalização/i });
    expect(link).toHaveAttribute("href", "/modulos/legalizacao");
  });

  it("sem nenhum Modulo real ainda (API vazia), Legalização continua bloqueada", async () => {
    renderSidebar();

    await screen.findByText("Legalização");
    expect(
      screen.queryByRole("link", { name: /legalização/i }),
    ).not.toBeInTheDocument();
  });

  it("um módulo sem rota configurada no frontend continua bloqueado mesmo com status 'ativo' no backend", async () => {
    // "Gestão RH" não tem `codigo`/`rota` em modulos-futuros.ts (ainda sem
    // página construída) -- mesmo que por algum motivo já exista um Modulo
    // "ativo" com esse código no banco, a checagem de rota/ícone continua
    // sendo do frontend, por decisão da própria issue.
    vi.mocked(listarModulos).mockResolvedValue([
      modulo({ id: 2, nome: "Gestão RH", codigo: "gestao-rh", status: "ativo" }),
    ]);

    renderSidebar();

    await screen.findByText("Legalização");
    expect(screen.getByText("Gestão RH")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /gestão rh/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Sidebar -- submenu expansível de Legalização (STC-496)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(listarModulos).mockResolvedValue([modulo({ status: "ativo" })]);
  });

  it("Legalização revela Matriz de Conformidade e Biblioteca de Documentos", async () => {
    renderSidebar();

    const linkMatriz = await screen.findByRole("link", {
      name: "Matriz de Conformidade",
    });
    const linkBiblioteca = screen.getByRole("link", {
      name: "Biblioteca de Documentos",
    });
    expect(linkMatriz).toHaveAttribute("href", "/modulos/legalizacao");
    expect(linkBiblioteca).toHaveAttribute(
      "href",
      "/modulos/legalizacao/biblioteca",
    );
  });

  it("recolhido por padrão fora de qualquer rota de Legalização", async () => {
    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.getByRole("button", { name: "Expandir Legalização" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("expande sozinho quando uma rota filha já está ativa (Biblioteca)", async () => {
    vi.mocked(usePathname).mockReturnValue("/modulos/legalizacao/biblioteca");

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.getByRole("button", { name: "Recolher Legalização" }),
    ).toHaveAttribute("aria-expanded", "true");
    // Match de prefixo mais específico -- "/biblioteca" não pode marcar
    // "Matriz de Conformidade" (prefixo mais curto, "/modulos/legalizacao")
    // como ativa também.
    expect(
      screen.getByRole("link", { name: "Biblioteca de Documentos" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Matriz de Conformidade" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("clique no chevron expande/recolhe manualmente mesmo fora da rota do módulo", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const botao = await screen.findByRole("button", {
      name: "Expandir Legalização",
    });
    await user.click(botao);

    expect(
      screen.getByRole("button", { name: "Recolher Legalização" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("clicar no rótulo 'Legalização' navega pra Matriz (mesma rota do módulo), sem exigir o chevron", async () => {
    renderSidebar();

    const linkLegalizacao = await screen.findByRole("link", {
      name: "Legalização",
    });
    expect(linkLegalizacao).toHaveAttribute("href", "/modulos/legalizacao");
  });
});

describe("Sidebar -- 'Catálogo de Legalização' dentro do submenu de Legalização (STC-514/STC-519)", () => {
  beforeEach(() => {
    vi.mocked(listarModulos).mockResolvedValue([modulo({ status: "ativo" })]);
  });

  it("Coordenador vê Catálogo de Legalização como 3º subitem, apontando pra /admin/permissoes", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    const link = screen.getByRole("link", { name: "Catálogo de Legalização" });
    // STC-519: rota própria (não /admin/permissoes com query string) --
    // PermissoesAdmin.tsx recebe abaInicial="catalogo-legalizacao" via
    // prop, a partir de qual page.tsx renderizou o componente.
    expect(link).toHaveAttribute("href", "/admin/permissoes/catalogo-legalizacao");
  });

  // STC-519: Admin (QG/Operações) já podia acessar o mesmo catálogo pelo
  // bloco "Administração" de baixo, só sem esse atalho direto -- passa a
  // ganhar o mesmo subitem que o Coordenador já tinha.
  it("Admin Operações também vê Catálogo de Legalização como subitem em Legalização (STC-519)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    const link = screen.getByRole("link", { name: "Catálogo de Legalização" });
    expect(link).toHaveAttribute("href", "/admin/permissoes/catalogo-legalizacao");
  });

  it("Admin Q&G também vê Catálogo de Legalização como subitem em Legalização (STC-519)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: true,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.getByRole("link", { name: "Catálogo de Legalização" }),
    ).toBeInTheDocument();
  });

  // STC-521: Setor de Legalização ganha o mesmo atalho que Coordenador/Admin
  // já tinham, mesmo motivo -- já pode escrever no catálogo pela API.
  it("Setor de Legalização também vê Catálogo de Legalização como subitem em Legalização (STC-521)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: false,
      isSetorLeg: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    const link = screen.getByRole("link", { name: "Catálogo de Legalização" });
    expect(link).toHaveAttribute("href", "/admin/permissoes/catalogo-legalizacao");
  });

  it("outro setor de nível Setor (não Legalização) não vê esse subitem extra em Legalização", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: false,
      isSetorLeg: false,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.queryByRole("link", { name: "Catálogo de Legalização" }),
    ).not.toBeInTheDocument();
  });

  // isCoordenacaoUnidade injeta um subitem cuja rota
  // (/admin/permissoes/catalogo-legalizacao) não é prefixo de href
  // (/modulos/legalizacao) -- sem considerar subitemAtivo no auto-expand,
  // um refresh direto nessa rota abria o submenu recolhido, escondendo o
  // próprio item ativo lá dentro.
  it("expande sozinho ao chegar direto em /admin/permissoes/catalogo-legalizacao (subitem ativo, não a rota do módulo)", async () => {
    vi.mocked(usePathname).mockReturnValue(
      "/admin/permissoes/catalogo-legalizacao",
    );
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.getByRole("button", { name: "Recolher Legalização" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Catálogo de Legalização" }),
    ).toHaveAttribute("aria-current", "page");
  });

  // STC-519 (achado em revisão de falhas críticas): antes de existir uma
  // rota própria pro atalho, "Catálogo de Legalização" e o link
  // "Administração" (bloco de baixo, Admin) compartilhavam o mesmo
  // pathname bare (/admin/permissoes) -- pathname.startsWith() não olha
  // querystring, então visitar /admin/permissoes por "Administração"
  // (mostrando Usuários) destacava/expandia "Catálogo de Legalização" como
  // se fosse a página ativa, rótulo errado pro que estava na tela.
  it("NÃO destaca 'Catálogo de Legalização' quando o pathname é só /admin/permissoes (link 'Administração', não o atalho)", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin/permissoes");
    vi.mocked(useAuth).mockReturnValue({
      isAdminQG: false,
      isAdminOps: true,
      isCoordenacaoUnidade: false,
    } as ReturnType<typeof useAuth>);

    renderSidebar();

    await screen.findByRole("link", { name: "Matriz de Conformidade" });
    expect(
      screen.getByRole("button", { name: "Expandir Legalização" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("link", { name: "Catálogo de Legalização" }),
    ).not.toHaveAttribute("aria-current", "page");
  });
});
