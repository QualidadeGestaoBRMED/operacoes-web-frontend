import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarraInferior } from "./BarraInferior";
import { identificarNavegador } from "./InstalarAppDialog";
import { Topbar } from "./Topbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/modulos/gestao-demandas" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/useNavegacao", () => ({
  useNavegacao: () => ({ modulos: [], temAdministracao: false, linkDjangoAdmin: null }),
  moduloAtivo: () => undefined,
}));
vi.mock("./NotificacoesMenu", () => ({ NotificacoesMenu: () => null }));
vi.mock("@/components/novidades/NovidadesProvider", () => ({
  useNovidades: () => ({ visiveis: [], temNovidade: false, destaque: null, marcarComoVistas: vi.fn() }),
}));

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

const UA = {
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  edgeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 EdgA/138.0.0.0",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0",
  operaAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 OPR/90.0.0.0",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

function noNavegador(userAgent: string, pontosDeToque = 0) {
  vi.stubGlobal("navigator", { ...navigator, userAgent, maxTouchPoints: pontosDeToque });
}

function blocos(janela: HTMLElement) {
  return within(janela)
    .getAllByRole("region")
    .map((secao) => secao.getAttribute("aria-labelledby"));
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

    expect(passos(janela, "iPhone e iPad")).toEqual([
      "1Toque em Compartilhar. Em alguns aparelhos, ele fica dentro do botão ••• da barra.",
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

  it.each([
    ["Mais", () => render(<BarraInferior />)],
    ["Olá, Felipe", () => render(<Topbar usuario={USUARIO} sidebarAberta />)],
  ])("fechada pelo X, o foco volta ao botão %s", async (botao, renderizar) => {
    renderizar();
    const janela = await abrirInstrucoes(botao);
    await userEvent.setup().click(within(janela).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: botao })).toHaveFocus();
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

  it("no celular, mostra só o navegador em uso; os outros ficam em \"Usa outro navegador?\"", async () => {
    noNavegador(UA.samsung);
    render(<BarraInferior />);
    const janela = await abrirInstrucoes("Mais");

    expect(blocos(janela)).toEqual(["instalar-samsung"]);
    expect(passos(janela, "Android")).toEqual([
      "1Toque no menu, as três linhas na barra de baixo.",
      '2Toque em "Adicionar página a".',
      '3Toque em "Tela inicial" e confirme.',
    ]);

    await userEvent.setup().click(within(janela).getByRole("button", { name: "Usa outro navegador?" }));
    expect(blocos(janela)).toEqual([
      "instalar-samsung",
      "instalar-safari-ios",
      "instalar-chrome-android",
      "instalar-chrome-ios",
      "instalar-edge-android",
      "instalar-firefox-android",
    ]);
    expect(janela).toHaveTextContent('Em qualquer outro, procure no menu a opção "Instalar"');
  });

  it("no computador, mostra Safari e Chrome do Android, com os outros recolhidos", async () => {
    noNavegador(UA.chromeWindows);
    render(<Topbar usuario={USUARIO} sidebarAberta />);
    const janela = await abrirInstrucoes("Olá, Felipe");

    expect(blocos(janela)).toEqual(["instalar-safari-ios", "instalar-chrome-android"]);
    expect(within(janela).getByRole("button", { name: "Usa outro navegador?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("navegador do celular sem instrução própria: orientação geral e os mais comuns", async () => {
    noNavegador(UA.operaAndroid);
    render(<BarraInferior />);
    const janela = await abrirInstrucoes("Mais");

    expect(janela).toHaveTextContent(
      'Procure no menu do seu navegador a opção "Instalar" ou "Adicionar à tela inicial".',
    );
    expect(blocos(janela)).toEqual(["instalar-safari-ios", "instalar-chrome-android"]);
  });
});

describe("identificarNavegador", () => {
  it.each([
    ["Safari no iPhone", UA.safariIphone, 0, "safari-ios"],
    ["Chrome no iPhone", UA.chromeIphone, 0, "chrome-ios"],
    ["iPad (se apresenta como Mac, com toque)", UA.ipad, 5, "safari-ios"],
    ["Mac de verdade (sem toque)", UA.ipad, 0, "computador"],
    ["Chrome no Android", UA.chromeAndroid, 0, "chrome-android"],
    ["Samsung Internet", UA.samsung, 0, "samsung"],
    ["Edge no Android", UA.edgeAndroid, 0, "edge-android"],
    ["Firefox no Android", UA.firefoxAndroid, 0, "firefox-android"],
    ["Opera no Android", UA.operaAndroid, 0, "outro"],
    ["Chrome no Windows", UA.chromeWindows, 0, "computador"],
  ])("%s", (_nome, userAgent, pontosDeToque, esperado) => {
    expect(identificarNavegador(userAgent, pontosDeToque)).toBe(esperado);
  });
});
