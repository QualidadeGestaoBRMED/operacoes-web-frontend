import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FaixaVerComo } from "./FaixaVerComo";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/plataforma", () => ({ encerrarVerComo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { encerrarVerComo } from "@/lib/plataforma";

const SESSAO = {
  id: "6f1c2a7e-0000-4000-8000-000000000001",
  usuario: { id: 7, nome: "Coordenação Niterói" },
  admin: { id: 1, nome: "Felipe" },
  iniciada_em: "2026-10-19T15:00:00Z",
  expira_em: "2099-10-19T16:00:00Z",
};

const navegar = vi.fn();

beforeEach(() => {
  navegar.mockReset();
  vi.mocked(encerrarVerComo).mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("location", { ...window.location, assign: navegar });
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("FaixaVerComo (STC-790)", () => {
  it("fora do ver como, nada", () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: null } as ReturnType<typeof useAuth>);
    const { container } = render(<FaixaVerComo />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra quem, que é só leitura e o Sair", () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: SESSAO } as ReturnType<typeof useAuth>);
    render(<FaixaVerComo />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Vendo como Coordenação Niterói (somente leitura)",
    );
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("Sair encerra no backend e volta ao Admin, na lista de usuários", async () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: SESSAO } as ReturnType<typeof useAuth>);
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
    render(<FaixaVerComo />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    expect(encerrarVerComo).toHaveBeenCalledWith(SESSAO.id);
    expect(navegar).toHaveBeenCalledWith("/admin/permissoes");
    expect(sessionStorage.getItem("atlas.verComo")).toBeNull();
  });

  it("Sair volta ao Admin mesmo se encerrar no backend falhar", async () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: SESSAO } as ReturnType<typeof useAuth>);
    vi.mocked(encerrarVerComo).mockRejectedValue(new Error("rede"));
    render(<FaixaVerComo />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    expect(navegar).toHaveBeenCalledWith("/admin/permissoes");
  });

  it("depois que o ver como terminou sozinho, o aviso aparece uma vez", () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: null } as ReturnType<typeof useAuth>);
    sessionStorage.setItem("atlas.verComoAviso", "O ver como terminou.");

    render(<FaixaVerComo />);

    expect(toast.info).toHaveBeenCalledWith("O ver como terminou.");
    expect(sessionStorage.getItem("atlas.verComoAviso")).toBeNull();
  });

  it("sem a resposta da API (carregando ou falhou), mostra a sessão desta aba", () => {
    vi.mocked(useAuth).mockReturnValue({ verComo: null } as ReturnType<typeof useAuth>);
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));

    render(<FaixaVerComo />);

    expect(screen.getByRole("status")).toHaveTextContent("Vendo como Coordenação Niterói");
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("se não deu para abrir como a pessoa, avisa e oferece tentar de novo", async () => {
    const recarregarUsuario = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      verComo: null,
      falhaAoAbrirVerComo: true,
      recarregarUsuario,
    } as unknown as ReturnType<typeof useAuth>);
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
    render(<FaixaVerComo />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Não foi possível abrir o Atlas como esta pessoa.",
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(recarregarUsuario).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
