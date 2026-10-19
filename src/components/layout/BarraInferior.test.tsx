import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, Users, Building2, Ruler } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuloNavegacao } from "@/hooks/useModulosNavegacao";
import { AbasDoModulo } from "./AbasDoModulo";
import { BarraInferior } from "./BarraInferior";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useModulosNavegacao", () => ({ useModulosNavegacao: vi.fn() }));

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import { useModulosNavegacao } from "@/hooks/useModulosNavegacao";

const LEGALIZACAO: ModuloNavegacao = {
  nome: "Legalização",
  icon: FileText,
  descricao: "",
  codigo: "legalizacao",
  rota: "/modulos/legalizacao",
  subitens: [
    { label: "Matriz de Conformidade", rota: "/modulos/legalizacao", curto: "Matriz" },
    { label: "Biblioteca de Documentos", rota: "/modulos/legalizacao/biblioteca", curto: "Biblioteca" },
  ],
  ativo: true,
};
const GESTAO_RH: ModuloNavegacao = {
  nome: "Gestão RH",
  icon: Users,
  descricao: "",
  codigo: "gestao-rh",
  rota: "/modulos/gestao-rh",
  subitens: [
    { label: "Painel de Absenteísmo", rota: "/modulos/gestao-rh", curto: "Absenteísmo" },
    { label: "Horas Extras", rota: "/modulos/gestao-rh/horas-extras", curto: "Horas Extras" },
  ],
  ativo: true,
};

type Cargo = "adminQG" | "gestaoOperacoes" | "adminOperacoes" | "adminOpex" | "coordenacao";

function comoCargo(cargo: Cargo) {
  const redes: string[] = {
    adminQG: ["opex", "padrao"],
    gestaoOperacoes: ["opex", "padrao"],
    adminOperacoes: ["padrao"],
    adminOpex: ["opex"],
    coordenacao: [],
  }[cargo];
  vi.mocked(useAuth).mockReturnValue({
    isAdminQG: cargo === "adminQG",
    isAdminOps: redes.length > 0,
    administraRedePadrao: redes.includes("padrao"),
    isCoordenacaoUnidade: cargo === "coordenacao",
    isSetorLeg: false,
  } as ReturnType<typeof useAuth>);
}

function naRota(rota: string) {
  vi.mocked(usePathname).mockReturnValue(rota);
}

function itensDaBarra() {
  const barra = screen.getByRole("navigation", { name: "Navegação principal" });
  return within(barra)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

async function abrirMais() {
  await userEvent.setup().click(screen.getByRole("button", { name: "Mais" }));
  return screen.getAllByRole("menuitem").map((item) => item.textContent);
}

beforeEach(() => {
  vi.mocked(useModulosNavegacao).mockReturnValue([LEGALIZACAO, GESTAO_RH]);
  naRota("/modulos/gestao-demandas");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BarraInferior (STC-787)", () => {
  it.each<[string, Cargo]>([
    ["Admin Q&G", "adminQG"],
    ["Gestão de Operações", "gestaoOperacoes"],
    ["Admin Operações (rede padrão)", "adminOperacoes"],
    ["coordenação", "coordenacao"],
  ])(
    "%s vê Demandas, Legalização e Gestão RH",
    (_, cargo) => {
      comoCargo(cargo);
      render(<BarraInferior />);
      expect(itensDaBarra()).toEqual(["Demandas", "Legalização", "Gestão RH"]);
    },
  );

  it("Admin Operações Especiais vê só Demandas (Legalização e Gestão RH são da rede padrão)", () => {
    comoCargo("adminOpex");
    render(<BarraInferior />);
    expect(itensDaBarra()).toEqual(["Demandas"]);
  });

  it("Admin Q&G: o Mais tem Administração, Admin Q&G, Recarregar e Sair", async () => {
    comoCargo("adminQG");
    render(<BarraInferior />);
    expect(await abrirMais()).toEqual(["Administração", "Admin Q&G", "Recarregar", "Sair"]);
  });

  it("coordenação: o Mais tem só Recarregar e Sair", async () => {
    comoCargo("coordenacao");
    render(<BarraInferior />);
    expect(await abrirMais()).toEqual(["Recarregar", "Sair"]);
  });

  it("Recarregar recarrega a página e Sair encerra a sessão", async () => {
    comoCargo("coordenacao");
    const recarregar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    render(<BarraInferior />);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Mais" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Recarregar" }));
    expect(recarregar).toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Mais" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Sair" }));
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
    vi.unstubAllGlobals();
  });

  it.each([
    ["/modulos/gestao-rh/horas-extras", "Gestão RH"],
    ["/admin/permissoes/parametros-gestao-rh", "Gestão RH"],
    ["/admin/permissoes/catalogo-legalizacao", "Legalização"],
    ["/modulos/gestao-demandas", "Demandas"],
  ])("em %s, o item ativo é %s", (rota, ativo) => {
    comoCargo("adminQG");
    naRota(rota);
    render(<BarraInferior />);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(ativo);
  });

  it("na Administração, nenhum módulo fica ativo e o Mais fica", () => {
    comoCargo("adminQG");
    naRota("/admin/permissoes");
    render(<BarraInferior />);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais" })).toHaveAttribute("aria-current", "page");
  });

  it("numa rota fora dos módulos e da Administração, nada fica ativo", () => {
    comoCargo("adminQG");
    naRota("/pagina-que-nao-existe");
    render(<BarraInferior />);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais" })).not.toHaveAttribute("aria-current");
  });

  it("num módulo da barra, o Mais não fica ativo", () => {
    comoCargo("adminQG");
    naRota("/modulos/legalizacao");
    render(<BarraInferior />);
    expect(screen.getByRole("button", { name: "Mais" })).not.toHaveAttribute("aria-current");
  });

  describe("com mais de 4 módulos", () => {
    beforeEach(() => {
      comoCargo("coordenacao");
      vi.mocked(useModulosNavegacao).mockReturnValue([
        LEGALIZACAO,
        GESTAO_RH,
        { nome: "Arquitetura", icon: Building2, descricao: "", codigo: "arquitetura", rota: "/modulos/arquitetura", ativo: true },
        { nome: "Calibração", icon: Ruler, descricao: "", codigo: "calibracao", rota: "/modulos/calibracao", ativo: true },
      ]);
    });

    it("os seguintes vão para o Mais", async () => {
      render(<BarraInferior />);

      expect(itensDaBarra()).toEqual(["Demandas", "Legalização", "Gestão RH", "Arquitetura"]);
      expect(await abrirMais()).toEqual(["Calibração", "Recarregar", "Sair"]);
    });

    it("na rota de um módulo do Mais, o Mais fica ativo e o módulo é o atual dentro dele", async () => {
      naRota("/modulos/calibracao/instrumentos");
      render(<BarraInferior />);

      expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mais" })).toHaveAttribute("aria-current", "page");
      await abrirMais();
      expect(screen.getByRole("menuitem", { name: "Calibração" })).toHaveAttribute("aria-current", "page");
    });
  });
});

describe("AbasDoModulo (STC-787)", () => {
  function abas() {
    return screen.queryAllByRole("link").map((link) => link.textContent);
  }

  it("Gestão RH para Admin: Absenteísmo, Horas Extras e Parâmetros, com a aba da rota ativa", () => {
    comoCargo("adminOperacoes");
    naRota("/modulos/gestao-rh/horas-extras");
    render(<AbasDoModulo />);

    expect(abas()).toEqual(["Absenteísmo", "Horas Extras", "Parâmetros"]);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent("Horas Extras");
  });

  it("Gestão RH para a coordenação: sem os Parâmetros", () => {
    comoCargo("coordenacao");
    naRota("/modulos/gestao-rh");
    render(<AbasDoModulo />);
    expect(abas()).toEqual(["Absenteísmo", "Horas Extras"]);
  });

  it("Legalização para a coordenação: Matriz, Biblioteca e Catálogo", () => {
    comoCargo("coordenacao");
    naRota("/modulos/legalizacao/biblioteca");
    render(<AbasDoModulo />);
    expect(abas()).toEqual(["Matriz", "Biblioteca", "Catálogo"]);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent("Biblioteca");
  });

  it("módulo sem seções (Gestão de Demandas) e Administração: sem abas", () => {
    comoCargo("adminQG");
    naRota("/modulos/gestao-demandas");
    const { unmount } = render(<AbasDoModulo />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    unmount();

    naRota("/admin/permissoes");
    render(<AbasDoModulo />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
