import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JanelaDeDestaque } from "./JanelaDeDestaque";

const push = vi.fn();
const marcarComoVistas = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useRouter: () => ({ push }) }));
vi.mock("./NovidadesProvider", () => ({ useNovidades: vi.fn() }));

import { usePathname } from "next/navigation";
import { useNovidades } from "./NovidadesProvider";

const DESTAQUE = {
  id: "2026-10-26-01-notificacoes-no-celular",
  data: "2026-10-26",
  titulo: "Notificações no celular",
  resumo: "Agora o Atlas avisa no celular.",
  modulos: [],
  admin: false,
  destaque: true,
  imagem: null,
  ajuda: null,
  abrir: null,
};

function comDestaque(destaque: typeof DESTAQUE | null) {
  vi.mocked(useNovidades).mockReturnValue({
    visiveis: [],
    temNovidade: true,
    destaque,
    marcarComoVistas,
  });
}

beforeEach(() => {
  push.mockReset();
  marcarComoVistas.mockReset().mockResolvedValue(undefined);
  vi.mocked(usePathname).mockReturnValue("/modulos/gestao-rh");
});

describe("JanelaDeDestaque (STC-877)", () => {
  it("abre sozinha com o destaque não visto", () => {
    comDestaque(DESTAQUE);
    render(<JanelaDeDestaque />);

    expect(screen.getByRole("dialog", { name: "Notificações no celular" })).toBeInTheDocument();
    expect(screen.getByText("Agora o Atlas avisa no celular.")).toBeInTheDocument();
  });

  it("Agora não: fecha e marca como vista", async () => {
    comDestaque(DESTAQUE);
    render(<JanelaDeDestaque />);

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));

    expect(marcarComoVistas).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Ver novidade: leva à página da novidade", async () => {
    comDestaque(DESTAQUE);
    render(<JanelaDeDestaque />);

    await userEvent.click(screen.getByRole("button", { name: "Ver novidade" }));

    expect(push).toHaveBeenCalledWith(`/novidades/${DESTAQUE.id}`);
  });

  it("não abre na própria página de Novidades nem sem destaque", () => {
    comDestaque(DESTAQUE);
    vi.mocked(usePathname).mockReturnValue("/novidades");
    const { unmount } = render(<JanelaDeDestaque />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    vi.mocked(usePathname).mockReturnValue("/modulos/gestao-rh");
    comDestaque(null);
    render(<JanelaDeDestaque />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
