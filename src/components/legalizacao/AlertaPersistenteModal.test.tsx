import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertaRegulatorio } from "@/types/legalizacao";
import { AlertaPersistenteModal } from "./AlertaPersistenteModal";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/legalizacao");

import { listarAlertasPendentes } from "@/lib/legalizacao";

function alerta(overrides: Partial<AlertaRegulatorio> = {}): AlertaRegulatorio {
  return {
    id: 1,
    documento_unidade: {
      id: 10,
      tipo_documento: {
        id: 1,
        codigo: "alvara-funcionamento",
        nome: "Alvará de Funcionamento",
        categoria: "regularizacao",
        area_responsavel: "legalizacao",
        setor_apoio: "",
        exige_validade: true,
        exige_protocolo: false,
        exige_evidencia: true,
        controlado_por_profissional: false,
        ativo: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      unidade: { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true },
      status: "regular",
      justificativa_excecao: "",
      validade: "2026-12-01",
      evidencia_vigente: null,
      regra_aplicada: null,
      responsaveis: [],
      profissional: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    ciclo_referencia: "2026-12-01",
    antecedencia_usada_dias: 60,
    criticidade: "alta",
    imediato: false,
    status_tratamento: "pendente",
    data_geracao: "2026-09-15T12:00:00Z",
    ...overrides,
  };
}

function renderModal() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AlertaPersistenteModal />
    </SWRConfig>,
  );
}

const empurrar = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: empurrar } as never);
});

describe("AlertaPersistenteModal (STC-443)", () => {
  it("sem alerta pendente, não mostra nada", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([]);

    renderModal();

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("1 alerta pendente: contagem no singular, mostra documento/unidade/criticidade", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);

    renderModal();

    expect(await screen.findByText("1 alerta regulatório pendente")).toBeInTheDocument();
    expect(screen.getByText("Alvará de Funcionamento")).toBeInTheDocument();
    expect(screen.getByText(/Niterói/)).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("vários alertas pendentes: contagem no plural", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([
      alerta({ id: 1 }),
      alerta({ id: 2, documento_unidade: { ...alerta().documento_unidade, id: 11 } }),
    ]);

    renderModal();

    expect(await screen.findByText("2 alertas regulatórios pendentes")).toBeInTheDocument();
  });

  it("clicar num alerta fecha o modal e navega pro documento", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByText("Alvará de Funcionamento"));

    expect(empurrar).toHaveBeenCalledWith("/modulos/legalizacao?documento=10");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it('clicar em "Ver depois" fecha o modal sem navegar', async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("button", { name: "Ver depois" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(empurrar).not.toHaveBeenCalled();
  });
});
