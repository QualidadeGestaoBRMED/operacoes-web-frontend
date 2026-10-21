import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarraInferior } from "./BarraInferior";
import { Topbar } from "./Topbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/modulos/gestao-demandas" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/useNavegacao", () => ({
  useNavegacao: () => ({ modulos: [], temAdministracao: false, linkDjangoAdmin: null }),
  moduloAtivo: () => undefined,
}));
vi.mock("./NotificacoesMenu", () => ({ NotificacoesMenu: () => null }));

const USUARIO = { nome: "Felipe", iniciais: "FC" };

function comoAppInstalado(instalado: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: instalado && query === "(display-mode: standalone)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

async function abrirInstrucoes(botaoDoMenu: string) {
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: botaoDoMenu }));
  await usuario.click(screen.getByRole("menuitem", { name: "Instalar o Atlas no celular" }));
  return screen.getByRole("dialog", { name: "Instalar o Atlas no celular" });
}

function passos(janela: HTMLElement, aparelho: string) {
  const secao = within(janela).getByRole("region", { name: new RegExp(`^${aparelho}`) });
  return within(secao)
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

beforeEach(() => comoAppInstalado(false));
afterEach(() => vi.unstubAllGlobals());

describe("Instruções para instalar o Atlas no celular", () => {
  it("o Mais da barra inferior abre os passos do iPhone e do Android", async () => {
    render(<BarraInferior />);
    const janela = await abrirInstrucoes("Mais");

    expect(passos(janela, "iPhone")).toEqual([
      "1Toque em Compartilhar. Em alguns iPhones, ele fica dentro do botão ••• da barra.",
      '2Toque em "Adicionar à Tela de Início".',
      '3Toque em "Adicionar".',
    ]);
    expect(passos(janela, "Android")).toEqual([
      "1Toque no menu, os três pontos no canto da tela.",
      '2Toque em "Instalar app" (ou "Adicionar à tela inicial").',
      '3Confirme em "Instalar".',
    ]);
  });

  it("o menu do nome na barra superior abre a mesma janela", async () => {
    render(<Topbar usuario={USUARIO} sidebarAberta onToggleSidebar={() => {}} />);
    const janela = await abrirInstrucoes("Olá, Felipe");

    expect(within(janela).getByRole("region", { name: /^iPhone/ })).toBeInTheDocument();
    expect(within(janela).getByRole("region", { name: /^Android/ })).toBeInTheDocument();
  });

  it("aberto como app instalado, o item some dos dois menus", async () => {
    comoAppInstalado(true);
    const usuario = userEvent.setup();

    const { unmount } = render(<BarraInferior />);
    await usuario.click(screen.getByRole("button", { name: "Mais" }));
    expect(screen.queryByRole("menuitem", { name: "Instalar o Atlas no celular" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Recarregar" })).toBeInTheDocument();
    unmount();

    render(<Topbar usuario={USUARIO} sidebarAberta />);
    await usuario.click(screen.getByRole("button", { name: "Olá, Felipe" }));
    expect(screen.queryByRole("menuitem", { name: "Instalar o Atlas no celular" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
  });

  it("no Safari do iPhone, o app instalado também é reconhecido por navigator.standalone", async () => {
    vi.stubGlobal("navigator", { ...navigator, standalone: true });
    render(<BarraInferior />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Mais" }));
    expect(screen.queryByRole("menuitem", { name: "Instalar o Atlas no celular" })).toBeNull();
  });
});
