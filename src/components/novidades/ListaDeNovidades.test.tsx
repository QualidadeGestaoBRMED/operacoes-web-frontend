import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NovidadeComTexto } from "./EntradaDaNovidade";
import { ListaDeNovidades } from "./ListaDeNovidades";

const marcarComoVistas = vi.fn();
vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: vi.fn() }));
vi.mock("./NovidadesProvider", () => ({ useNovidades: () => ({ marcarComoVistas }) }));

import { useNavegacao } from "@/hooks/useNavegacao";

function novidade(id: string, extra: Partial<NovidadeComTexto> = {}): NovidadeComTexto {
  return {
    id,
    data: id.slice(0, 10),
    titulo: id,
    resumo: "",
    modulos: [],
    admin: false,
    destaque: false,
    imagem: null,
    ajuda: null,
    texto: null,
    busca: "",
    ...extra,
  };
}

const NOVIDADES = [
  novidade("2026-10-26-01-celular", { titulo: "Notificações no celular", busca: "resumo das 7h" }),
  novidade("2026-10-23-01-horas", { titulo: "Horas perdidas", modulos: ["gestao-rh"] }),
  novidade("2026-10-22-01-mapa", { titulo: "Mapa de Conformidade", modulos: ["legalizacao"] }),
];

function titulos() {
  return screen.queryAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent);
}

beforeEach(() => {
  marcarComoVistas.mockReset();
  vi.mocked(useNavegacao).mockReturnValue({
    modulos: [
      { codigo: "legalizacao", nome: "Legalização" },
      { codigo: "gestao-rh", nome: "Gestão RH" },
    ],
    temAdministracao: false,
  } as unknown as ReturnType<typeof useNavegacao>);
});

describe("ListaDeNovidades (STC-877)", () => {
  it("da mais nova para a mais antiga, com o título levando à página da novidade", () => {
    render(<ListaDeNovidades novidades={NOVIDADES} />);

    expect(titulos()).toEqual(["Notificações no celular", "Horas perdidas", "Mapa de Conformidade"]);
    expect(screen.getByRole("link", { name: "Horas perdidas" })).toHaveAttribute(
      "href",
      "/novidades/2026-10-23-01-horas",
    );
    expect(marcarComoVistas).toHaveBeenCalled();
  });

  it("abas por módulo: as gerais só em Todas", async () => {
    render(<ListaDeNovidades novidades={NOVIDADES} />);

    await userEvent.click(screen.getByRole("tab", { name: "Gestão RH" }));

    expect(titulos()).toEqual(["Horas perdidas"]);
  });

  it("busca no título e no texto, sem acento e sem maiúscula", async () => {
    render(<ListaDeNovidades novidades={NOVIDADES} />);
    const busca = screen.getByRole("searchbox", { name: "Buscar novidades" });

    await userEvent.type(busca, "NOTIFICACOES");
    expect(titulos()).toEqual(["Notificações no celular"]);

    await userEvent.clear(busca);
    await userEvent.type(busca, "resumo das 7h");
    expect(titulos()).toEqual(["Notificações no celular"]);

    await userEvent.clear(busca);
    await userEvent.type(busca, "férias");
    expect(screen.getByText('Nenhuma novidade encontrada para "férias".')).toBeInTheDocument();
  });

  it("um módulo só com novidade: sem abas", () => {
    render(<ListaDeNovidades novidades={NOVIDADES.slice(0, 2)} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("copiar link: o endereço da página da novidade", async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    render(<ListaDeNovidades novidades={NOVIDADES} />);

    const entrada = screen.getByRole("heading", { name: "Mapa de Conformidade" }).closest("li")!;
    await userEvent.click(within(entrada).getByRole("button", { name: /Copiar link/ }));

    expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/novidades/2026-10-22-01-mapa`);
  });
});
