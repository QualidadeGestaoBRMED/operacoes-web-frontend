import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ativarPush, desativarPush, estadoDoPush, type EstadoPush } from "@/lib/pushNotificacoes";
import { NotificacoesCelularDialog } from "./NotificacoesCelularDialog";

vi.mock("@/lib/pushNotificacoes", () => ({
  estadoDoPush: vi.fn(),
  ativarPush: vi.fn(),
  desativarPush: vi.fn(),
}));
vi.mock("./InstalarAppDialog", () => ({ useAppInstalado: () => false }));

function abrir(estado: EstadoPush, onInstalar = vi.fn()) {
  vi.mocked(estadoDoPush).mockResolvedValue(estado);
  render(
    <NotificacoesCelularDialog
      aberto
      onOpenChange={vi.fn()}
      focoAoFechar={createRef()}
      onInstalar={onInstalar}
    />,
  );
  return onInstalar;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(ativarPush).mockReset();
  vi.mocked(desativarPush).mockReset().mockResolvedValue(undefined);
});

describe("NotificacoesCelularDialog (STC-851)", () => {
  it("explica o que chega e o horário silencioso", async () => {
    abrir("desativado");

    expect(screen.getByText("Demandas atribuídas a você e pedidos de aprovação")).toBeInTheDocument();
    expect(screen.getByText(/Das 20h às 7h nada chega/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Ativar notificações" })).toBeInTheDocument();
  });

  it("ativar: inscreve e passa a oferecer Desativar", async () => {
    vi.mocked(ativarPush).mockResolvedValue("ativado");
    abrir("desativado");

    await userEvent.click(await screen.findByRole("button", { name: "Ativar notificações" }));

    expect(ativarPush).toHaveBeenCalled();
    expect(await screen.findByText("Ativadas neste aparelho.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeInTheDocument();
  });

  it("recusar a permissão na hora: mostra como liberar", async () => {
    vi.mocked(ativarPush).mockResolvedValue("bloqueado");
    abrir("desativado");

    await userEvent.click(await screen.findByRole("button", { name: "Ativar notificações" }));

    expect(await screen.findByText(/estão bloqueadas neste aparelho/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).not.toBeInTheDocument();
  });

  it("ativado: desativar cancela", async () => {
    abrir("ativado");

    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(desativarPush).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Ativar notificações" })).toBeInTheDocument();
  });

  it("iPhone fora do app: leva às instruções de instalação", async () => {
    const onInstalar = abrir("precisa-instalar");

    expect(await screen.findByText(/só funcionam com o Atlas instalado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver como instalar" }));

    expect(onInstalar).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).not.toBeInTheDocument();
  });

  it.each([
    ["nao-suportado", /Este navegador não recebe notificações/],
    ["indisponivel", /ainda não estão disponíveis/],
  ] as const)("%s: explica, sem botão de ativar", async (estado, texto) => {
    abrir(estado);

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).not.toBeInTheDocument();
  });

  it("no ver como: explica, sem ativar nem desativar", async () => {
    sessionStorage.setItem(
      "atlas.verComo",
      JSON.stringify({
        id: "6f1c2a7e-0000-4000-8000-000000000001",
        usuario: { id: 7, nome: "Coordenação" },
        admin: { id: 1, nome: "Admin" },
        iniciada_em: "2026-10-19T15:00:00Z",
        expira_em: "2099-10-19T16:00:00Z",
      }),
    );
    abrir("desativado");

    expect(await screen.findByText(/não podem ser ativadas nem desativadas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).not.toBeInTheDocument();
  });

  it("sem resposta do Atlas: avisa e deixa tentar de novo, sem dizer que o navegador não suporta", async () => {
    vi.mocked(estadoDoPush).mockRejectedValueOnce(new Error("rede")).mockResolvedValue("desativado");
    render(
      <NotificacoesCelularDialog aberto onOpenChange={vi.fn()} focoAoFechar={createRef()} onInstalar={vi.fn()} />,
    );

    expect(await screen.findByText(/Não foi possível verificar as notificações agora/)).toBeInTheDocument();
    expect(screen.queryByText(/Este navegador não recebe/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("button", { name: "Ativar notificações" })).toBeInTheDocument();
  });
});
