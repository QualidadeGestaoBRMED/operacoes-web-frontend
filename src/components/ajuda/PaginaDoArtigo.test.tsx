import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtigoResumido } from "@/lib/ajuda";
import { PaginaDoArtigo } from "./PaginaDoArtigo";

let estado: { visiveis: ArtigoResumido[]; carregando: boolean; falha: boolean };
vi.mock("./AjudaProvider", () => ({
  useAjuda: () => ({ ...estado, modulos: [{ codigo: "legalizacao", nome: "Legalização" }], recarregar: vi.fn() }),
}));

function artigo(slug: string, ordem: number): ArtigoResumido {
  return { slug, titulo: `Título ${slug}`, resumo: "Resumo.", modulo: "legalizacao", admin: false, telas: ["/modulos/legalizacao/mapa"], ordem };
}

const [A, B, C] = [artigo("a", 1), artigo("b", 2), artigo("c", 3)];

beforeEach(() => {
  estado = { visiveis: [A, B, C], carregando: false, falha: false };
});

describe("PaginaDoArtigo (STC-878)", () => {
  it("trilha, título, texto, a tela no Atlas e os vizinhos do mesmo grupo", () => {
    render(<PaginaDoArtigo artigo={B} texto={<p>O texto</p>} />);

    expect(screen.getByRole("link", { name: "Legalização" })).toHaveAttribute("href", "/ajuda#grupo-legalizacao");
    expect(screen.getByRole("heading", { name: "Título b" })).toBeInTheDocument();
    expect(screen.getByText("O texto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir no Atlas/ })).toHaveAttribute("href", "/modulos/legalizacao/mapa");
    expect(screen.getByRole("link", { name: /Anterior/ })).toHaveAttribute("href", "/ajuda/a");
    expect(screen.getByRole("link", { name: /Próximo/ })).toHaveAttribute("href", "/ajuda/c");
  });

  it("artigo que a pessoa não vê: avisa, sem o texto", () => {
    estado = { ...estado, visiveis: [A] };
    render(<PaginaDoArtigo artigo={B} texto={<p>O texto</p>} />);

    expect(screen.getByText("Este artigo não está disponível para você.")).toBeInTheDocument();
    expect(screen.queryByText("O texto")).not.toBeInTheDocument();
  });

  it("com falha nos módulos: não diz que é indisponível", () => {
    estado = { ...estado, falha: true };
    render(<PaginaDoArtigo artigo={B} texto={<p>O texto</p>} />);

    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.queryByText(/não está disponível/)).not.toBeInTheDocument();
  });
});
