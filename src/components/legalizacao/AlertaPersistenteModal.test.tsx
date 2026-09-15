import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { SWRConfig, useSWRConfig } from "swr";
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

// Expõe um botão pra forçar revalidação do SWR sob demanda -- simula o
// poll de 60s sem depender de timer real/fake.
function Harness() {
  const { mutate } = useSWRConfig();
  return (
    <>
      <button type="button" onClick={() => mutate("alertas-pendentes")}>
        revalidar
      </button>
      <AlertaPersistenteModal />
    </>
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

  // Achado em code review: uma falha na busca virava "sem alerta" (mesmo
  // resultado visual de tudo em dia) -- o modal precisa aparecer mesmo sem
  // nenhum alerta carregado, avisando que não deu pra checar.
  it("falha ao buscar (sem nenhum dado anterior): mostra aviso, não fica em silêncio", async () => {
    vi.mocked(listarAlertasPendentes).mockRejectedValue(new Error("Falha de rede."));

    renderModal();

    expect(
      await screen.findByText("Não foi possível verificar alertas pendentes"),
    ).toBeInTheDocument();
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

  // Achado em code review: a versão original reabria em QUALQUER mudança de
  // contagem, inclusive uma queda (alerta resolvido) -- o modal pipocava de
  // novo bem na hora em que o usuário tinha acabado de tratar algo.
  // mutate() aqui simula o poll de 60s sob demanda, sem depender de timer.
  it("dispensado, NÃO reabre quando a contagem cai (alerta resolvido), mas reabre quando sobe (alerta novo)", async () => {
    vi.mocked(listarAlertasPendentes)
      .mockResolvedValueOnce([alerta({ id: 1 }), alerta({ id: 2 }), alerta({ id: 3 })])
      .mockResolvedValueOnce([alerta({ id: 1 }), alerta({ id: 2 })])
      .mockResolvedValueOnce([alerta({ id: 1 }), alerta({ id: 2 }), alerta({ id: 4 })]);

    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Harness />
      </SWRConfig>,
    );

    expect(await screen.findByText("3 alertas regulatórios pendentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver depois" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // poll traz contagem menor (2) -- não deve reabrir
    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // poll seguinte traz contagem maior (3, um alerta novo) -- deve reabrir
    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("3 alertas regulatórios pendentes")).toBeInTheDocument();
  });

  // Achado em code review (2ª rodada, ponto levantado como "validar com o
  // time"): comparar só a CONTAGEM deixava passar batido o caso de um
  // alerta ser resolvido e outro surgir no mesmo ciclo de poll -- a
  // contagem total fica igual (3 -> 3), mas o conjunto de ids mudou de
  // verdade (id 3 some, id 4 aparece). Precisa reabrir mesmo assim.
  it("dispensado, reabre quando a contagem fica IGUAL mas o conjunto de ids muda (resolvido + novo no mesmo poll)", async () => {
    vi.mocked(listarAlertasPendentes)
      .mockResolvedValueOnce([alerta({ id: 1 }), alerta({ id: 2 }), alerta({ id: 3 })])
      .mockResolvedValueOnce([alerta({ id: 1 }), alerta({ id: 2 }), alerta({ id: 4 })]);

    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Harness />
      </SWRConfig>,
    );

    expect(await screen.findByText("3 alertas regulatórios pendentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver depois" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("3 alertas regulatórios pendentes")).toBeInTheDocument();
  });
});
