import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NovidadeComTexto } from "./EntradaDaNovidade";
import { PaginaDaNovidade } from "./PaginaDaNovidade";

const marcarComoVistas = vi.fn();
let visiveis: { id: string; titulo: string }[] = [];
vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: vi.fn() }));
const recarregarModulos = vi.fn();
let falhaNosModulos: Error | undefined;
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({ isLoading: false, error: falhaNosModulos, recarregar: recarregarModulos }),
}));
vi.mock("./NovidadesProvider", () => ({ useNovidades: () => ({ visiveis, marcarComoVistas }) }));

import { useNavegacao } from "@/hooks/useNavegacao";

const HORAS: NovidadeComTexto = {
  id: "2026-10-23-01-horas",
  data: "2026-10-23",
  titulo: "Horas perdidas",
  resumo: "Clique no card.",
  modulos: ["gestao-rh"],
  admin: false,
  destaque: false,
  imagem: null,
  ajuda: null,
  abrir: null,
  texto: null,
  busca: "",
};

function comModulos(codigos: string[]) {
  vi.mocked(useNavegacao).mockReturnValue({
    modulos: codigos.map((codigo) => ({ codigo, nome: codigo })),
    temAdministracao: false,
  } as unknown as ReturnType<typeof useNavegacao>);
}

beforeEach(() => {
  marcarComoVistas.mockReset();
  recarregarModulos.mockReset();
  falhaNosModulos = undefined;
  visiveis = [];
});

describe("PaginaDaNovidade (STC-877)", () => {
  it("mostra a novidade, volta para a lista e marca só ela como vista", () => {
    comModulos(["gestao-rh"]);
    render(<PaginaDaNovidade novidade={HORAS} />);

    expect(screen.getByRole("heading", { name: "Horas perdidas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Todas as novidades" })).toHaveAttribute("href", "/novidades");
    expect(marcarComoVistas).toHaveBeenCalledWith("2026-10-23-01-horas");
  });

  it("de um módulo que a pessoa não acessa: avisa, sem o conteúdo", () => {
    comModulos(["legalizacao"]);
    render(<PaginaDaNovidade novidade={HORAS} />);

    expect(screen.getByText("Esta novidade não está disponível para você.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Horas perdidas" })).not.toBeInTheDocument();
  });

  it("sem a lista de módulos (falha na busca): não diz que é indisponível e deixa tentar de novo", async () => {
    comModulos([]);
    falhaNosModulos = new Error("rede");
    render(<PaginaDaNovidade novidade={HORAS} />);

    expect(screen.queryByText("Esta novidade não está disponível para você.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(recarregarModulos).toHaveBeenCalled();
  });

  it("anterior e próxima: as vizinhas, da mais nova para a mais antiga", () => {
    comModulos(["gestao-rh"]);
    visiveis = [
      { id: "2026-10-26-01-celular", titulo: "Notificações no celular" },
      { id: "2026-10-23-01-horas", titulo: "Horas perdidas" },
      { id: "2026-10-20-01-mapa", titulo: "Mapa de Conformidade" },
    ];
    render(<PaginaDaNovidade novidade={HORAS} />);

    expect(screen.getByRole("link", { name: /Novidade anterior.*Mapa de Conformidade/ })).toHaveAttribute(
      "href",
      "/novidades/2026-10-20-01-mapa",
    );
    expect(screen.getByRole("link", { name: /Próxima novidade.*Notificações no celular/ })).toHaveAttribute(
      "href",
      "/novidades/2026-10-26-01-celular",
    );
  });
});
