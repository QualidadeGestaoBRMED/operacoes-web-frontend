import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NovidadeComTexto } from "./EntradaDaNovidade";
import { PaginaDaNovidade } from "./PaginaDaNovidade";

const marcarComoVistas = vi.fn();
vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: vi.fn() }));
vi.mock("@/hooks/useModulos", () => ({ useModulos: () => ({ isLoading: false }) }));
vi.mock("./NovidadesProvider", () => ({ useNovidades: () => ({ marcarComoVistas }) }));

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
  texto: null,
  busca: "",
};

function comModulos(codigos: string[]) {
  vi.mocked(useNavegacao).mockReturnValue({
    modulos: codigos.map((codigo) => ({ codigo, nome: codigo })),
    temAdministracao: false,
  } as unknown as ReturnType<typeof useNavegacao>);
}

beforeEach(() => marcarComoVistas.mockReset());

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
});
