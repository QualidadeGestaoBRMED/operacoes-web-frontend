import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/modulos/gestao-rh"),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", async (original) => ({
  ...(await original<typeof import("@/hooks/useMediaQuery")>()),
  useMediaQuery: vi.fn(),
}));
vi.mock("@/hooks/useModulosNavegacao", () => ({ useModulosNavegacao: vi.fn(() => []) }));
vi.mock("./NotificacoesMenu", () => ({ NotificacoesMenu: () => null }));
vi.mock("@/components/legalizacao/AlertaPersistenteModal", () => ({
  AlertaPersistenteModal: () => null,
}));
vi.mock("@/lib/pushNotificacoes", async (original) => ({
  ...(await original<typeof import("@/lib/pushNotificacoes")>()),
  sincronizarPush: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { sincronizarPush } from "@/lib/pushNotificacoes";

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ isLoading: false } as ReturnType<typeof useAuth>);
  vi.mocked(sincronizarPush).mockReset().mockResolvedValue(undefined);
});

describe("AppShell, navegação por tamanho de tela (STC-787)", () => {
  it("celular: barra inferior, sem menu lateral nem o botão dele", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    render(<AppShell>conteúdo</AppShell>);

    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /menu lateral/ })).not.toBeInTheDocument();
  });

  it("computador: menu lateral e o botão dele, sem barra inferior", () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    render(<AppShell>conteúdo</AppShell>);

    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esconder menu lateral" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).not.toBeInTheDocument();
  });
});

describe("AppShell, notificações no celular (STC-851)", () => {
  it("passa a inscrição do aparelho para quem está logado, uma vez por usuário", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(useAuth).mockReturnValue({ isLoading: true } as ReturnType<typeof useAuth>);
    const { rerender } = render(<AppShell>conteúdo</AppShell>);
    expect(sincronizarPush).not.toHaveBeenCalled();

    const comUsuario = { isLoading: false, user: { id: 7, first_name: "Ana" } };
    vi.mocked(useAuth).mockReturnValue(comUsuario as unknown as ReturnType<typeof useAuth>);
    rerender(<AppShell>conteúdo</AppShell>);
    rerender(<AppShell>outro conteúdo</AppShell>);

    expect(sincronizarPush).toHaveBeenCalledTimes(1);
  });
});
