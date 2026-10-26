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
  return { slug, titulo: slug, resumo: "", modulo: null, admin: false, telas: [], ordem: 100, busca: "", ...extra };
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
