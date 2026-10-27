import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtigoResumido } from "@/lib/ajuda";
import { BotaoDeAjuda } from "./BotaoDeAjuda";

let pathname = "/";
let visiveis: ArtigoResumido[] = [];
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("./AjudaProvider", () => ({
  useAjuda: () => ({
    visiveis,
    modulos: [
      { codigo: "legalizacao", nome: "Legalização", rota: "/modulos/legalizacao", subitens: [] },
      { codigo: "gestao-rh", nome: "Gestão RH", rota: "/modulos/gestao-rh", subitens: [] },
    ],
  }),
}));
vi.mock("@/app/(app)/ajuda/textoDoArtigo", () => ({
  textoDoArtigo: vi.fn(async (slug: string) => <p>Texto de {slug}</p>),
}));

function artigo(slug: string, extra: Partial<ArtigoResumido> = {}): ArtigoResumido {
  return { slug, titulo: `Título ${slug}`, resumo: `Resumo ${slug}`, modulo: "legalizacao", admin: false, telas: [], ordem: 100, popular: false, icone: null, ...extra };
}

beforeEach(() => {
  pathname = "/";
  visiveis = [];
});

describe("BotaoDeAjuda (STC-878)", () => {
  it("tela com artigo: abre o artigo inteiro no painel, com o caminho para a Ajuda", async () => {
    pathname = "/modulos/legalizacao/mapa";
    visiveis = [artigo("mapa", { telas: ["/modulos/legalizacao/mapa"] })];
    render(<BotaoDeAjuda />);

    await userEvent.click(screen.getByRole("button", { name: "Ajuda desta tela" }));

    expect(screen.getByRole("dialog", { name: "Título mapa" })).toBeInTheDocument();
    expect(await screen.findByText("Texto de mapa")).toBeInTheDocument();
    expect(screen.getByText("Ajuda · Legalização")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir em página própria" })).toHaveAttribute("href", "/ajuda/mapa");
    expect(screen.getByRole("link", { name: /Ver tudo na Ajuda/ })).toHaveAttribute("href", "/ajuda");
  });

  it("trocar de tela fecha o painel, e voltar a ela não o reabre", async () => {
    pathname = "/modulos/legalizacao/mapa";
    visiveis = [artigo("mapa", { telas: ["/modulos/legalizacao/mapa", "/modulos/legalizacao/biblioteca"] })];
    const { rerender } = render(<BotaoDeAjuda />);
    await userEvent.click(screen.getByRole("button", { name: "Ajuda desta tela" }));

    pathname = "/modulos/legalizacao/biblioteca";
    rerender(<BotaoDeAjuda />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    pathname = "/modulos/legalizacao/mapa";
    rerender(<BotaoDeAjuda />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mais de um artigo na tela: primeiro a lista, depois o escolhido", async () => {
    pathname = "/modulos/legalizacao/mapa";
    visiveis = [
      artigo("cores", { telas: ["/modulos/legalizacao/mapa"] }),
      artigo("filtros", { telas: ["/modulos/legalizacao/mapa"] }),
    ];
    render(<BotaoDeAjuda />);

    await userEvent.click(screen.getByRole("button", { name: "Ajuda desta tela" }));
    expect(screen.getByRole("dialog", { name: "Ajuda desta tela" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Título filtros/ }));

    expect(await screen.findByText("Texto de filtros")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Outros artigos desta tela/ }));
    expect(screen.getByRole("button", { name: /Título cores/ })).toBeInTheDocument();
  });

  it("tela sem artigo: leva à Ajuda, no grupo do módulo quando ele tem artigo", () => {
    pathname = "/modulos/legalizacao/biblioteca";
    visiveis = [artigo("mapa", { telas: ["/modulos/legalizacao/mapa"] })];
    render(<BotaoDeAjuda />);

    expect(screen.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda#grupo-legalizacao");
  });

  it("módulo sem artigo: leva ao começo da Ajuda", () => {
    pathname = "/modulos/gestao-rh";
    visiveis = [artigo("mapa", { telas: ["/modulos/legalizacao/mapa"] })];
    render(<BotaoDeAjuda />);

    expect(screen.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda");
  });
});
