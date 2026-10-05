import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParametrosAbsenteismoResposta,
  ReguaFeriasResposta,
  VersaoMarcoRegua,
  VersaoParametrosAbsenteismo,
} from "@/types/gestaoRH";
import { ParametrosGestaoRHAdmin } from "./ParametrosGestaoRHAdmin";

vi.mock("@/lib/gestaoRH", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRH")>()),
  buscarParametrosAbsenteismo: vi.fn(),
  salvarParametrosAbsenteismo: vi.fn(),
  buscarReguaFerias: vi.fn(),
  salvarReguaFerias: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from "sonner";
import {
  buscarParametrosAbsenteismo,
  buscarReguaFerias,
  salvarParametrosAbsenteismo,
  salvarReguaFerias,
} from "@/lib/gestaoRH";

const VERSAO_INICIAL: VersaoParametrosAbsenteismo = {
  id: 1,
  limite_atraso_minutos: 15,
  tipos_computados: ["falta", "atestado"],
  meta_percentual: null,
  faixas: null,
  vigente_a_partir_de: "2000-01-01",
  salvo_por: null,
  versao_inicial: true,
  created_at: "2026-10-05T10:00:00Z",
};

function parametros(vigente: VersaoParametrosAbsenteismo): ParametrosAbsenteismoResposta {
  return { vigente, versoes: [vigente] };
}

function marco(
  tipo_marco: VersaoMarcoRegua["tipo_marco"],
  dias: number,
  extra: Partial<VersaoMarcoRegua> = {},
): VersaoMarcoRegua {
  return {
    id: dias + 1,
    tipo_marco,
    rotulo: tipo_marco,
    dias,
    ativo: true,
    editavel: tipo_marco !== "limite_vencido",
    vigente_a_partir_de: "2000-01-01",
    salvo_por: null,
    versao_inicial: true,
    created_at: "2026-10-05T10:00:00Z",
    ...extra,
  };
}

const REGUA: ReguaFeriasResposta = {
  marcos: [
    marco("completou_periodo", 0),
    marco("antes_do_limite", 80),
    marco("antes_do_inicio_substituicao", 40),
    marco("limite_vencido", 0),
  ],
  versoes: [],
};

function erro400(data: unknown) {
  return new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    data,
  } as AxiosResponse);
}

function renderTela(opcoesSWR: Record<string, unknown> = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), ...opcoesSWR }}>
      <ParametrosGestaoRHAdmin />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(parametros(VERSAO_INICIAL));
  vi.mocked(buscarReguaFerias).mockResolvedValue(REGUA);
});

describe("Parâmetros de absenteísmo", () => {
  it("abre na aba Absenteísmo e férias, com a versão inicial e o aviso de sem faixas", async () => {
    renderTela();

    expect(await screen.findByText("Versão inicial")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Absenteísmo e férias" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/Sem faixas cadastradas/)).toBeInTheDocument();
    expect(screen.getByLabelText("Limite de atraso e saída antecipada (minutos)")).toHaveValue(15);
    expect(screen.getByRole("checkbox", { name: "Falta" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Afastamento" })).not.toBeChecked();
  });

  it("mostra quem salvou a versão vigente", async () => {
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({
        ...VERSAO_INICIAL,
        versao_inicial: false,
        salvo_por: "Ana Admin",
        vigente_a_partir_de: "2026-10-05",
        meta_percentual: "5.00",
        faixas: { atencao_a_partir_de: "5.00", critica_acima_de: "8.00" },
      }),
    );

    renderTela();

    expect(
      await screen.findByText("Versão vigente desde 05/10/2026, por Ana Admin"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Faixa crítica acima de (%)")).toHaveValue(8);
    expect(screen.queryByText(/Sem faixas cadastradas/)).not.toBeInTheDocument();
  });

  it("salva a nova versão com as faixas e os tipos escolhidos", async () => {
    const user = userEvent.setup();
    vi.mocked(salvarParametrosAbsenteismo).mockResolvedValue({
      dados: parametros({ ...VERSAO_INICIAL, id: 2, versao_inicial: false, salvo_por: "Ana" }),
      criouVersao: true,
    });
    renderTela();
    await screen.findByText("Versão inicial");

    await user.type(screen.getByLabelText("Meta de absenteísmo (%)"), "5");
    await user.type(screen.getByLabelText("Faixa de atenção a partir de (%)"), "5");
    await user.type(screen.getByLabelText("Faixa crítica acima de (%)"), "8");
    await user.click(screen.getByRole("checkbox", { name: "Afastamento" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() =>
      expect(salvarParametrosAbsenteismo).toHaveBeenCalledWith({
        limite_atraso_minutos: 15,
        meta_percentual: "5",
        faixas: { atencao_a_partir_de: "5", critica_acima_de: "8" },
        tipos_computados: ["falta", "atestado", "afastamento"],
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("botões ficam desabilitados até haver alteração, e voltam a ficar se ela for desfeita", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");
    const salvar = screen.getByRole("button", { name: "Salvar nova versão" });
    expect(salvar).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Afastamento" }));
    expect(salvar).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Afastamento" }));
    expect(salvar).toBeDisabled();
  });

  it("avisa quando a API diz que não há alteração", async () => {
    // Ex.: outro Admin já salvou exatamente os mesmos valores.
    const user = userEvent.setup();
    vi.mocked(salvarParametrosAbsenteismo).mockResolvedValue({
      dados: parametros(VERSAO_INICIAL),
      criouVersao: false,
    });
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("checkbox", { name: "Afastamento" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    [{ atencao: "5", critica: "" }, "Preencha as duas faixas"],
    [{ atencao: "8", critica: "8" }, "precisa começar acima"],
  ])("recusa faixas inválidas sem chamar a API (%o)", async ({ atencao, critica }, mensagem) => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");

    await user.type(screen.getByLabelText("Faixa de atenção a partir de (%)"), atencao);
    if (critica) await user.type(screen.getByLabelText("Faixa crítica acima de (%)"), critica);
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    expect(await screen.findByText(new RegExp(mensagem))).toBeInTheDocument();
    expect(salvarParametrosAbsenteismo).not.toHaveBeenCalled();
  });

  it("limite vazio é obrigatório, não vira 0", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");

    await user.clear(screen.getByLabelText("Limite de atraso e saída antecipada (minutos)"));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    expect(await screen.findByText("Obrigatório.")).toBeInTheDocument();
    expect(salvarParametrosAbsenteismo).not.toHaveBeenCalled();
  });

  it("recarregar a versão vigente não apaga uma edição em andamento", async () => {
    const user = userEvent.setup();
    renderTela({ dedupingInterval: 0, focusThrottleInterval: 0 });
    await screen.findByText("Versão inicial");
    await user.type(screen.getByLabelText("Meta de absenteísmo (%)"), "7");

    // Outro Admin salvou: a tela revalida ao voltar o foco.
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({
        ...VERSAO_INICIAL,
        id: 2,
        limite_atraso_minutos: 30,
        versao_inicial: false,
        salvo_por: "Outro Admin",
        vigente_a_partir_de: "2026-10-05",
      }),
    );
    fireEvent(window, new Event("focus"));

    expect(
      await screen.findByText("Versão vigente desde 05/10/2026, por Outro Admin"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Meta de absenteísmo (%)")).toHaveValue(7);
    expect(screen.getByLabelText("Limite de atraso e saída antecipada (minutos)")).toHaveValue(15);
  });

  it("exige ao menos um tipo de ocorrência", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("checkbox", { name: "Falta" }));
    await user.click(screen.getByRole("checkbox", { name: "Atestado" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    expect(await screen.findByText("Escolha ao menos um tipo.")).toBeInTheDocument();
    expect(salvarParametrosAbsenteismo).not.toHaveBeenCalled();
  });

  it("mostra o erro da API no campo", async () => {
    const user = userEvent.setup();
    vi.mocked(salvarParametrosAbsenteismo).mockRejectedValue(
      erro400({ tipos_computados: ["Férias e banco de horas nunca contam no absenteísmo."] }),
    );
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("checkbox", { name: "Afastamento" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    expect(
      await screen.findByText("Férias e banco de horas nunca contam no absenteísmo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("Régua de férias", () => {
  it("mostra os três marcos editáveis, sem limite vencido e sem dias no completou", async () => {
    renderTela();
    await screen.findByText("Régua de alertas de férias");

    expect(screen.getByText("Completou o período de direito")).toBeInTheDocument();
    expect(screen.getByLabelText("Dias: dias antes do limite para tirar")).toHaveValue(80);
    expect(screen.getByLabelText("Dias: dias antes do início das férias")).toHaveValue(40);
    expect(screen.queryByLabelText(/Dias: Completou/)).not.toBeInTheDocument();
    expect(screen.queryByText(/limite vencido/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });

  it("salva os três marcos de uma vez", async () => {
    const user = userEvent.setup();
    vi.mocked(salvarReguaFerias).mockResolvedValue({ dados: REGUA, criouVersao: true });
    renderTela();
    await screen.findByText("Régua de alertas de férias");

    const dias = screen.getByLabelText("Dias: dias antes do limite para tirar");
    await user.clear(dias);
    await user.type(dias, "60");
    await user.click(screen.getByRole("switch", { name: "Ativar: Completou o período de direito" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(salvarReguaFerias).toHaveBeenCalledWith([
        { tipo_marco: "completou_periodo", dias: 0, ativo: false },
        { tipo_marco: "antes_do_limite", dias: 60, ativo: true },
        { tipo_marco: "antes_do_inicio_substituicao", dias: 40, ativo: true },
      ]),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("mostra o erro da API da régua", async () => {
    const user = userEvent.setup();
    vi.mocked(salvarReguaFerias).mockRejectedValue(
      erro400({ marcos: [{}, { dias: ["Para este marco, os dias vão de 1 a 365."] }, {}] }),
    );
    renderTela();
    await screen.findByText("Régua de alertas de férias");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    const dias = screen.getByLabelText("Dias: dias antes do limite para tirar");
    await user.clear(dias);
    await user.type(dias, "400");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const erro = await screen.findByText("Para este marco, os dias vão de 1 a 365.");
    const linhaDoMarco = screen
      .getByLabelText("Dias: dias antes do limite para tirar")
      .closest("li") as HTMLElement;
    expect(linhaDoMarco).toContainElement(erro);
  });
});

describe("Aba Importação", () => {
  it("abre com o formulário desligado e o aviso, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("tab", { name: "Importação" }));

    const painel = await screen.findByRole("tabpanel", { name: "Importação" });
    expect(
      within(painel).getByText("A importação será ativada quando a fonte dos dados for definida."),
    ).toBeInTheDocument();
    expect(within(painel).getByLabelText("Início do período *")).toBeDisabled();
    expect(within(painel).getByRole("button", { name: "Importar relatórios" })).toBeDisabled();
    expect(within(painel).getByText("Espelho de ponto")).toBeInTheDocument();
    expect(within(painel).getByText("Pendências")).toBeInTheDocument();
    expect(within(painel).getAllByRole("button", { name: "Selecionar" })).toHaveLength(2);
    expect(within(painel).getByText("Nenhuma importação ainda.")).toBeInTheDocument();
    expect(salvarParametrosAbsenteismo).not.toHaveBeenCalled();
  });
});
