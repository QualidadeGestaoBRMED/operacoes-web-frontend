import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notificacao } from "@/types";
import { NotificacoesMenu } from "./NotificacoesMenu";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useNotificacoes", () => ({ useNotificacoes: vi.fn() }));

import { useNotificacoes } from "@/hooks/useNotificacoes";

const NOTIFICACAO: Notificacao = {
  id: 1,
  tipo: "responsavel_atribuido",
  titulo: "Você foi adicionado a uma demanda",
  link: "/modulos/gestao-demandas?demanda=9",
  lida: false,
  created_at: "2026-10-19T12:00:00Z",
};

const SESSAO = {
  id: "6f1c2a7e-0000-4000-8000-000000000001",
  usuario: { id: 7, nome: "Coordenação" },
  admin: { id: 1, nome: "Admin" },
  iniciada_em: "2026-10-19T15:00:00Z",
  expira_em: "2099-10-19T16:00:00Z",
};

const marcarComoLida = vi.fn();
const marcarTodasComoLidas = vi.fn();

beforeEach(() => {
  push.mockReset();
  marcarComoLida.mockReset();
  marcarTodasComoLidas.mockReset();
  vi.mocked(useNotificacoes).mockReturnValue({
    notificacoes: [NOTIFICACAO],
    naoLidas: [NOTIFICACAO],
    naoLidasCount: 1,
    marcarComoLida,
    marcarTodasComoLidas,
  } as unknown as ReturnType<typeof useNotificacoes>);
});

afterEach(() => sessionStorage.clear());

async function abrirMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Notificações/ }));
  return user;
}

describe("NotificacoesMenu", () => {
  it("abrir uma notificação marca como lida e navega", async () => {
    render(<NotificacoesMenu />);
    const user = await abrirMenu();

    expect(screen.getByRole("button", { name: /Marcar todas como lidas/ })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Você foi adicionado/ }));

    expect(marcarComoLida).toHaveBeenCalledWith(NOTIFICACAO);
    expect(push).toHaveBeenCalledWith(NOTIFICACAO.link);
  });

  it("em ver como (STC-790): abrir só navega, e sem Marcar todas como lidas", async () => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
    render(<NotificacoesMenu />);
    const user = await abrirMenu();

    expect(screen.queryByRole("button", { name: /Marcar todas como lidas/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Você foi adicionado/ }));

    expect(marcarComoLida).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(NOTIFICACAO.link);
  });
});
