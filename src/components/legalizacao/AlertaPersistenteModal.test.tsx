import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SWRConfig, useSWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertaRegulatorio } from "@/types/legalizacao";
import { AlertaPersistenteModal } from "./AlertaPersistenteModal";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
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
        permite_multiplas_instancias: false,
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

// Atalho pra criar um alerta de um documento ESPECÍFICO -- vários testes
// abaixo simulam "N pendências" e precisam deixar claro se são N alertas do
// MESMO documento (colapsam numa linha, agrupamento por documento) ou de
// documentos DIFERENTES (N linhas).
function alertaDoDocumento(
  alertaId: number,
  documentoId: number,
  overrides: Partial<AlertaRegulatorio> = {},
): AlertaRegulatorio {
  const base = alerta({ id: alertaId, ...overrides });
  return { ...base, documento_unidade: { ...base.documento_unidade, id: documentoId } };
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
  vi.mocked(usePathname).mockReturnValue("/modulos/legalizacao");
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
});

describe("AlertaPersistenteModal (STC-443)", () => {
  // Achado em code review (3ª rodada): um link direto pra
  // /modulos/legalizacao?documento=57 (salvo, compartilhado) abre
  // DetalheDocumentoModal via MatrizConformidade -- sem essa supressão, o
  // alerta persistente abria por cima ao mesmo tempo, dois <Dialog> juntos.
  it("com ?documento= já ativo na URL, não abre (mesmo com alerta pendente)", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ documento: "57" }) as never,
    );
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);

    renderModal();

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Achado em code review (5ª rodada): a supressão existente só cobria a
  // colisão com DetalheDocumentoModal (?documento= na URL) -- qualquer
  // outro <Dialog>/<AlertDialog> da plataforma (form de demanda,
  // ConfirmDialog etc.) já aberto quando um alerta novo chega (poll) também
  // não devia levar o alerta persistente a abrir por cima.
  it("com outro <Dialog>/<AlertDialog> já aberto na página, não abre -- e abre assim que ele fecha, sem esperar poll", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);
    const outroDialogo = document.createElement("div");
    outroDialogo.setAttribute("role", "alertdialog");
    outroDialogo.setAttribute("data-state", "open");
    document.body.appendChild(outroDialogo);

    try {
      renderModal();
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // fecha o outro diálogo -- MutationObserver reage sem precisar de poll novo
      outroDialogo.setAttribute("data-state", "closed");
      expect(await screen.findByText("Alvará de Funcionamento")).toBeInTheDocument();
    } finally {
      outroDialogo.remove();
    }
  });

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

  it("1 documento pendente: contagem no singular, mostra documento/unidade/criticidade", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);

    renderModal();

    expect(await screen.findByText("1 documento regulatório pendente")).toBeInTheDocument();
    expect(screen.getByText("Alvará de Funcionamento")).toBeInTheDocument();
    expect(screen.getByText(/Niterói/)).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("vários documentos pendentes: contagem no plural, 1 linha por documento", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([
      alertaDoDocumento(1, 10),
      alertaDoDocumento(2, 11),
    ]);

    renderModal();

    expect(await screen.findByText("2 documentos regulatórios pendentes")).toBeInTheDocument();
  });

  // Achado no feedback visual: o mesmo documento pode ter mais de um
  // AlertaRegulatorio pendente ao mesmo tempo (ex. imediato de movimentação
  // profissional + de ciclo da varredura diária) -- contar/listar por
  // ALERTA fazia o mesmo documento aparecer 2x na lista.
  it("mesmo documento com 2 alertas pendentes: 1 linha só, criticidade mais alta, data mais antiga", async () => {
    vi.mocked(listarAlertasPendentes).mockResolvedValue([
      alertaDoDocumento(1, 10, {
        criticidade: "baixa",
        data_geracao: "2026-09-15T12:00:00Z",
      }),
      alertaDoDocumento(2, 10, {
        criticidade: "alta",
        data_geracao: "2026-09-10T12:00:00Z",
      }),
    ]);

    renderModal();

    expect(await screen.findByText("1 documento regulatório pendente")).toBeInTheDocument();
    expect(screen.getAllByText("Alvará de Funcionamento")).toHaveLength(1);
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.queryByText("Baixa")).not.toBeInTheDocument();
    expect(screen.getByText(/· 2 alertas/)).toBeInTheDocument();
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

  // Achado em code review: sobrescrever a querystring inteira perdia
  // filtro ativo (ex. ?unidade=5) quando o usuário já estava na própria
  // Matriz -- o modal é montado fora de qualquer rota e pode disparar com
  // o usuário já lá (poll de 60s trazendo um alerta novo).
  it("clicar num alerta com filtro de unidade já ativo na Matriz preserva o filtro na URL", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ unidade: "5" }) as never);
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByText("Alvará de Funcionamento"));

    expect(empurrar).toHaveBeenCalledWith("/modulos/legalizacao?unidade=5&documento=10");
  });

  it("clicar num alerta vindo de outra tela (fora da Matriz) não carrega parâmetros daquela tela", async () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ algumFiltro: "x" }) as never);
    vi.mocked(listarAlertasPendentes).mockResolvedValue([alerta()]);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByText("Alvará de Funcionamento"));

    expect(empurrar).toHaveBeenCalledWith("/modulos/legalizacao?documento=10");
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
      .mockResolvedValueOnce([
        alertaDoDocumento(1, 10),
        alertaDoDocumento(2, 11),
        alertaDoDocumento(3, 12),
      ])
      .mockResolvedValueOnce([alertaDoDocumento(1, 10), alertaDoDocumento(2, 11)])
      .mockResolvedValueOnce([
        alertaDoDocumento(1, 10),
        alertaDoDocumento(2, 11),
        alertaDoDocumento(4, 13),
      ]);

    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Harness />
      </SWRConfig>,
    );

    expect(await screen.findByText("3 documentos regulatórios pendentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver depois" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // poll traz contagem menor (2) -- não deve reabrir
    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // poll seguinte traz contagem maior (3, um alerta novo) -- deve reabrir
    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("3 documentos regulatórios pendentes")).toBeInTheDocument();
  });

  // Achado em code review (2ª rodada, ponto levantado como "validar com o
  // time"): comparar só a CONTAGEM deixava passar batido o caso de um
  // alerta ser resolvido e outro surgir no mesmo ciclo de poll -- a
  // contagem total fica igual (3 -> 3), mas o conjunto de ids mudou de
  // verdade (id 3 some, id 4 aparece). Precisa reabrir mesmo assim.
  it("dispensado, reabre quando a contagem fica IGUAL mas o conjunto de ids muda (resolvido + novo no mesmo poll)", async () => {
    vi.mocked(listarAlertasPendentes)
      .mockResolvedValueOnce([
        alertaDoDocumento(1, 10),
        alertaDoDocumento(2, 11),
        alertaDoDocumento(3, 12),
      ])
      .mockResolvedValueOnce([
        alertaDoDocumento(1, 10),
        alertaDoDocumento(2, 11),
        alertaDoDocumento(4, 13),
      ]);

    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Harness />
      </SWRConfig>,
    );

    expect(await screen.findByText("3 documentos regulatórios pendentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver depois" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "revalidar" }));
    await waitFor(() => expect(listarAlertasPendentes).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("3 documentos regulatórios pendentes")).toBeInTheDocument();
  });
});
