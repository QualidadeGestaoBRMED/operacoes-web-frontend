import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtigoResumido } from "@/lib/ajuda";
import { ListaDaAjuda, type ArtigoComBusca } from "./ListaDaAjuda";

const recarregar = vi.fn();
let estado: { visiveis: ArtigoResumido[]; carregando: boolean; falha: boolean };
vi.mock("./AjudaProvider", () => ({
  useAjuda: () => ({
    ...estado,
    modulos: [{ codigo: "legalizacao", nome: "Legalização" }],
    recarregar,
  }),
}));

function artigo(slug: string, extra: Partial<ArtigoComBusca> = {}): ArtigoComBusca {
  return { slug, titulo: slug, resumo: "", modulo: null, admin: false, telas: [], ordem: 100, popular: false, icone: null, busca: "", ...extra };
}

const ARTIGOS = [
  artigo("primeiro-acesso", { titulo: "Primeiro acesso" }),
  artigo("mapa", { titulo: "Como ler o Mapa", modulo: "legalizacao", busca: "as cores das células" }),
  artigo("ferias", { titulo: "Férias", modulo: "gestao-rh" }),
];

beforeEach(() => {
  recarregar.mockReset();
  estado = { visiveis: ARTIGOS.slice(0, 2), carregando: false, falha: false };
});

describe("ListaDaAjuda (STC-878)", () => {
  it("cards agrupados, só os artigos que a pessoa vê", () => {
    render(<ListaDaAjuda artigos={ARTIGOS} />);

    const grupos = screen.getAllByRole("region");
    expect(grupos.map((grupo) => within(grupo).getByRole("heading").textContent)).toEqual([
      "Primeiros passos",
      "Legalização",
    ]);
    expect(screen.getByRole("link", { name: /Como ler o Mapa/ })).toHaveAttribute("href", "/ajuda/mapa");
    expect(screen.queryByText("Férias")).not.toBeInTheDocument();
  });

  it("todos populares: sem Mais usados, que repetiria a página inteira", () => {
    estado = { ...estado, visiveis: [{ ...ARTIGOS[1], popular: true }] };
    render(<ListaDaAjuda artigos={[{ ...ARTIGOS[1], popular: true }]} />);

    expect(screen.queryByRole("heading", { name: "Mais usados" })).not.toBeInTheDocument();
  });

  it("Mais usados no topo, com os populares; na busca, some para não repetir o artigo", async () => {
    estado = { ...estado, visiveis: [ARTIGOS[0], { ...ARTIGOS[1], popular: true }] };
    render(<ListaDaAjuda artigos={[ARTIGOS[0], { ...ARTIGOS[1], popular: true }, ARTIGOS[2]]} />);

    const [maisUsados] = screen.getAllByRole("region");
    expect(within(maisUsados).getByRole("heading").textContent).toBe("Mais usados");
    expect(within(maisUsados).getAllByRole("link").map((link) => link.textContent)).toEqual(["Como ler o Mapa"]);

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar na Ajuda" }), "mapa");
    expect(screen.queryByRole("heading", { name: "Mais usados" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("Mais usados: no máximo 4, uma linha", () => {
    const muitos = ["a", "b", "c", "d", "e"].map((slug) => artigo(slug, { titulo: slug, popular: true }));
    const todos = [...muitos, artigo("f", { titulo: "f" })];
    estado = { ...estado, visiveis: todos };
    render(<ListaDaAjuda artigos={todos} />);

    const [maisUsados] = screen.getAllByRole("region");
    expect(within(maisUsados).getAllByRole("link")).toHaveLength(4);
  });

  it("busca no texto, sem acento", async () => {
    render(<ListaDaAjuda artigos={ARTIGOS} />);

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar na Ajuda" }), "celulas");

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Como ler o Mapa"]);
  });

  it("com os módulos carregando: nem cards nem aviso de vazio", () => {
    estado = { ...estado, carregando: true };
    render(<ListaDaAjuda artigos={ARTIGOS} />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há artigos/)).not.toBeInTheDocument();
  });

  it("com falha nos módulos: avisa e deixa tentar de novo", async () => {
    estado = { ...estado, falha: true };
    render(<ListaDaAjuda artigos={ARTIGOS} />);

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(recarregar).toHaveBeenCalled();
  });
});
