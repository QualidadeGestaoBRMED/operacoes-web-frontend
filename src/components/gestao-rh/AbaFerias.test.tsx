import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CabecalhoColaborador,
  FeriasColaborador,
  PeriodoPendente,
} from "@/types/gestaoRH";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";

vi.mock("@/lib/gestaoRHFerias", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHFerias")>()),
  buscarColaboradorRH: vi.fn(),
  buscarFeriasColaborador: vi.fn(),
  programarFerias: vi.fn(),
  adiarProgramacao: vi.fn(),
  registrarRhAcionado: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from "sonner";
import {
  adiarProgramacao,
  buscarColaboradorRH,
  buscarFeriasColaborador,
  programarFerias,
  registrarRhAcionado,
} from "@/lib/gestaoRHFerias";

const COLABORADOR: CabecalhoColaborador = {
  id: 1,
  nome: "Marcos Lima",
  matricula_vr: "005977",
  cargo: "Técnico de Enfermagem",
  unidade: { id: 6, nome: "Macaé" },
  data_admissao: "2024-08-20",
  ativo: true,
  alertas_pendentes: { ferias: 4, absenteismo: 0 },
};

function periodo(id: number, extra: Partial<PeriodoPendente> = {}): PeriodoPendente {
  return {
    id,
    inicio_aquisitivo: "2025-08-20",
    fim_aquisitivo: "2026-08-19",
    limite_concessivo: "2027-08-19",
    status: "pendente",
    programacao: null,
    direito_adquirido_em: "2026-08-20",
    limite_vencido_ha_dias: null,
    marcos: [
      {
        tipo: "completou_periodo",
        rotulo: "Completou o período de direito",
        data: "2026-08-20",
        situacao: "alerta_gerado",
        demanda_id: 9,
      },
      {
        tipo: "antes_do_limite",
        rotulo: "Dias antes do limite para tirar",
        data: "2027-05-31",
        situacao: "proximo",
        demanda_id: null,
      },
      { tipo: "limite", rotulo: "Limite para tirar", data: "2027-08-19", situacao: "futuro", demanda_id: null },
    ],
    adiamento: null,
    pode_programar: true,
    pode_adiar: true,
    pode_registrar_rh_acionado: false,
    ...extra,
  };
}

const VENCIDO = periodo(1, {
  inicio_aquisitivo: "2024-08-20",
  fim_aquisitivo: "2025-08-19",
  limite_concessivo: "2026-08-19",
  status: "limite_vencido",
  direito_adquirido_em: "2025-08-20",
  limite_vencido_ha_dias: 48,
  marcos: [
    { tipo: "limite", rotulo: "Limite para tirar", data: "2026-08-19", situacao: "vencido", demanda_id: 7 },
  ],
  pode_adiar: false,
});

function ferias(extra: Partial<FeriasColaborador> = {}): FeriasColaborador {
  return {
    periodos_pendentes: [VENCIDO, periodo(2)],
    ferias_tiradas: [],
    periodo_em_andamento: {
      id: 3,
      inicio_aquisitivo: "2026-08-20",
      fim_aquisitivo: "2027-08-19",
      direito_a_partir_de: "2027-08-20",
    },
    dias_antes_do_inicio_substituicao: 40,
    historico: [
      {
        acao: "alerta_ferias_gerado",
        valor_anterior: "",
        valor_novo: "Dias antes do limite para tirar",
        justificativa: "",
        regra_gatilho: "antes_do_limite",
        por: null,
        automatico: true,
        em: "2026-10-06T07:37:00-03:00",
      },
    ],
    ...extra,
  };
}

const PROGRAMADO_COM_SUBSTITUICAO = periodo(2, {
  status: "programado",
  programacao: {
    id: 5,
    data_inicio: "2026-11-23",
    data_fim: "2026-12-22",
    dias: 30,
    necessita_substituicao: true,
    data_limite_substituicao: "2026-10-14",
    rh_acionado_em: null,
    rh_acionado_por: null,
  },
  pode_adiar: false,
  pode_registrar_rh_acionado: true,
});

function erro400(data: unknown) {
  return new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    data,
  } as AxiosResponse);
}

function renderModal(periodoEmFoco: number | null = null) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <DetalheColaboradorModal colaboradorId={1} periodoEmFoco={periodoEmFoco} onFechar={vi.fn()} />
    </SWRConfig>,
  );
}

function card(titulo: string) {
  return within(screen.getByRole("region", { name: titulo }));
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.mocked(buscarColaboradorRH).mockResolvedValue(COLABORADOR);
  vi.mocked(buscarFeriasColaborador).mockResolvedValue(ferias());
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function usuario() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe("Modal do colaborador · aba Férias", () => {
  it("falha ao carregar o colaborador oferece tentar de novo", async () => {
    vi.mocked(buscarColaboradorRH).mockRejectedValueOnce(new Error("Falha de rede"));
    const user = usuario();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <DetalheColaboradorModal colaboradorId={1} periodoEmFoco={null} onFechar={vi.fn()} />
      </SWRConfig>,
    );

    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "Marcos Lima" })).toBeInTheDocument();
  });

  it("cabeçalho e dados do colaborador; aba Férias com os alertas pendentes", async () => {
    renderModal();

    expect(await screen.findByRole("heading", { name: "Marcos Lima" })).toBeInTheDocument();
    expect(screen.getByText("Técnico de Enfermagem · Macaé")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Férias\s*4 alertas/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("20/08/2024")).toBeInTheDocument();
  });

  it("no celular, matrícula e admissão vão para a linha do cabeçalho", async () => {
    renderModal();

    const linha = await screen.findByText("Matrícula 005977 · Admissão 20/08/2024");
    expect(linha).toHaveClass("sm:hidden");
  });

  it("no celular, sem data de admissão, a linha do cabeçalho diz que não foi informada", async () => {
    vi.mocked(buscarColaboradorRH).mockResolvedValue({ ...COLABORADOR, data_admissao: null });
    renderModal();

    expect(
      await screen.findByText("Matrícula 005977 · Admissão não informada"),
    ).toHaveClass("sm:hidden");
  });

  it("com mais de um período, avisa e pede o mais antigo primeiro (pagamento em dobro no vencido)", async () => {
    renderModal();

    expect(
      await screen.findByText(/2 períodos com férias pendentes\. O mais antigo já passou do limite/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Próximo direito a partir de 20/08/2027 (período 20/08/2026 a 19/08/2027, em andamento)."),
    ).toBeInTheDocument();
  });

  it("limite vencido: programar sim, \"Não programar agora\" não", async () => {
    renderModal();
    await screen.findByText(/2 períodos/);

    const vencido = card("Período 20/08/2024 a 19/08/2025");
    expect(vencido.getByText("vencido há 48 dias · demanda aberta · pagamento em dobro")).toBeInTheDocument();
    expect(vencido.getByRole("button", { name: "Programar férias" })).toBeInTheDocument();
    expect(vencido.queryByRole("button", { name: "Não programar agora" })).not.toBeInTheDocument();

    const pendente = card("Período 20/08/2025 a 19/08/2026");
    expect(pendente.getByRole("button", { name: "Não programar agora" })).toBeInTheDocument();
    expect(pendente.getByText("próximo alerta")).toBeInTheDocument();
  });

  it("uma demanda por período: o primeiro marco abre, os seguintes atualizam", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(
      ferias({
        periodos_pendentes: [
          {
            ...VENCIDO,
            marcos: [
              { tipo: "completou_periodo", rotulo: "", data: "2025-08-20", situacao: "alerta_gerado", demanda_id: 7 },
              { tipo: "antes_do_limite", rotulo: "", data: "2026-05-31", situacao: "alerta_gerado", demanda_id: 7 },
              { tipo: "limite", rotulo: "", data: "2026-08-19", situacao: "vencido", demanda_id: 7 },
            ],
          },
        ],
      }),
    );
    renderModal();

    const vencido = within(await screen.findByRole("region", { name: "Período 20/08/2024 a 19/08/2025" }));
    expect(vencido.getByText("alerta gerado · demanda aberta")).toBeInTheDocument();
    expect(vencido.getByText("alerta gerado · demanda atualizada")).toBeInTheDocument();
    expect(
      vencido.getByText("vencido há 48 dias · demanda atualizada · pagamento em dobro"),
    ).toBeInTheDocument();
  });

  it("aberto pelo card do Kanban, rola até o período do alerta", async () => {
    renderModal(2);

    await screen.findByText(/2 períodos/);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    const alvo = screen.getByRole("region", { name: "Período 20/08/2025 a 19/08/2026" });
    expect(scrollIntoView.mock.contexts[0]).toBe(alvo);
    expect(alvo).toHaveFocus();
  });

  it("uma ação por vez: com um formulário aberto, os outros botões ficam desligados", async () => {
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);

    await user.click(card("Período 20/08/2025 a 19/08/2026").getByRole("button", { name: "Programar férias" }));

    expect(
      card("Período 20/08/2024 a 19/08/2025").getByRole("button", { name: "Programar férias" }),
    ).toBeDisabled();
  });

  it.each([
    ["2026-10-01", "2026-10-10", "O início não pode ser antes de hoje."],
    ["2026-11-01", "2026-12-05", "No máximo 30 dias por programação."],
    ["2027-08-10", "2027-08-25", "As férias precisam terminar até o limite para tirar (19/08/2027)."],
  ])("programar recusa sem chamar a API (%s a %s)", async (inicio, fim, mensagem) => {
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.type(pendente.getByLabelText("Início *"), inicio);
    await user.type(pendente.getByLabelText("Fim *"), fim);
    await user.click(pendente.getByRole("button", { name: "Registrar programação" }));

    expect(await pendente.findByText(mensagem)).toBeInTheDocument();
    expect(programarFerias).not.toHaveBeenCalled();
  });

  it("programar envia datas e substituição, e mostra os dias calculados", async () => {
    vi.mocked(programarFerias).mockResolvedValue(
      ferias({ periodos_pendentes: [VENCIDO, PROGRAMADO_COM_SUBSTITUICAO] }),
    );
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.type(pendente.getByLabelText("Início *"), "2026-11-23");
    await user.type(pendente.getByLabelText("Fim *"), "2026-12-22");
    expect(pendente.getByText("30 dias")).toBeInTheDocument();
    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));
    await user.click(pendente.getByRole("button", { name: "Registrar programação" }));

    await waitFor(() =>
      expect(programarFerias).toHaveBeenCalledWith(2, {
        data_inicio: "2026-11-23",
        data_fim: "2026-12-22",
        necessita_substituicao: true,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Férias programadas.");
    expect(await screen.findByText("Acionar o RH até 14/10/2026")).toBeInTheDocument();
  });

  it("com substituição, mostra antes de registrar até quando acionar o RH e acompanha o início", async () => {
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));
    expect(pendente.queryByText(/Acionar o RH até/)).not.toBeInTheDocument();

    await user.type(pendente.getByLabelText("Início *"), "2026-11-23");
    expect(
      pendente.getByText("Acionar o RH até 14/10/2026 (40 dias antes do início das férias)."),
    ).toBeInTheDocument();

    await user.clear(pendente.getByLabelText("Início *"));
    await user.type(pendente.getByLabelText("Início *"), "2026-11-10");
    expect(pendente.getByText(/O prazo para acionar o RH passou em 01\/10\/2026/)).toBeInTheDocument();

    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));
    expect(pendente.queryByText(/acionar o RH (até|passou)/i)).not.toBeInTheDocument();
  });

  it("marco de substituição desativado: sem prazo no formulário", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(
      ferias({ dias_antes_do_inicio_substituicao: null }),
    );
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.type(pendente.getByLabelText("Início *"), "2026-11-23");
    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));

    expect(pendente.queryByText(/Acionar o RH até/)).not.toBeInTheDocument();
    expect(pendente.queryByText(/Abre o prazo/)).not.toBeInTheDocument();
    expect(
      pendente.getByText("Registra que o colaborador precisa de substituto durante as férias."),
    ).toBeInTheDocument();
  });

  it("sem o campo na resposta, o formulário segue sem aviso e sem quebrar", async () => {
    const semCampo = ferias();
    delete semCampo.dias_antes_do_inicio_substituicao;
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(semCampo);
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));
    await user.type(pendente.getByLabelText("Início *"), "2026-11-23");

    expect(pendente.queryByText(/acionar o RH (até|passou)/i)).not.toBeInTheDocument();
    expect(pendente.getByRole("button", { name: "Registrar programação" })).toBeInTheDocument();
  });

  it("início antes de hoje não mostra prazo", async () => {
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.click(pendente.getByRole("switch", { name: "Precisa de substituição" }));
    await user.type(pendente.getByLabelText("Início *"), "0002-11-23");

    expect(pendente.queryByText(/acionar o RH (até|passou)/i)).not.toBeInTheDocument();
  });

  it("vencido aceita férias depois do limite, com o aviso de pagamento em dobro", async () => {
    vi.mocked(programarFerias).mockResolvedValue(ferias());
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const vencido = card("Período 20/08/2024 a 19/08/2025");

    await user.click(vencido.getByRole("button", { name: "Programar férias" }));
    expect(vencido.getByText(/as férias deste período serão pagas em dobro/)).toBeInTheDocument();
    await user.type(vencido.getByLabelText("Início *"), "2026-10-20");
    await user.type(vencido.getByLabelText("Fim *"), "2026-11-18");
    await user.click(vencido.getByRole("button", { name: "Registrar programação" }));

    await waitFor(() => expect(programarFerias).toHaveBeenCalledWith(1, expect.anything()));
  });

  it("reprogramar férias de período já vencido (programado) aceita fim depois do limite", async () => {
    // A API devolve limite_vencido_ha_dias nulo para período programado; o
    // vencimento vale pela data, como na API.
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(
      ferias({
        periodos_pendentes: [
          {
            ...VENCIDO,
            status: "programado",
            limite_vencido_ha_dias: null,
            programacao: {
              id: 8,
              data_inicio: "2026-11-02",
              data_fim: "2026-11-21",
              dias: 20,
              necessita_substituicao: false,
              data_limite_substituicao: null,
              rh_acionado_em: null,
              rh_acionado_por: null,
            },
          },
        ],
      }),
    );
    vi.mocked(programarFerias).mockResolvedValue(ferias());
    const user = usuario();
    renderModal();
    const programado = await screen.findByRole("region", { name: "Período 20/08/2024 a 19/08/2025" });

    expect(within(programado).getByText("(vencido)")).toBeInTheDocument();
    await user.click(within(programado).getByRole("button", { name: "Reprogramar férias" }));
    expect(within(programado).getByText(/serão pagas em dobro/)).toBeInTheDocument();
    await user.clear(within(programado).getByLabelText("Fim *"));
    await user.type(within(programado).getByLabelText("Fim *"), "2026-11-28");
    await user.click(within(programado).getByRole("button", { name: "Registrar programação" }));

    await waitFor(() =>
      expect(programarFerias).toHaveBeenCalledWith(1, {
        data_inicio: "2026-11-02",
        data_fim: "2026-11-28",
        necessita_substituicao: false,
      }),
    );
  });

  it("erro da API ao programar aparece no campo", async () => {
    vi.mocked(programarFerias).mockRejectedValue(
      erro400({ data_inicio: ["Férias que já começaram não podem ser reprogramadas."] }),
    );
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Programar férias" }));
    await user.type(pendente.getByLabelText("Início *"), "2026-11-23");
    await user.type(pendente.getByLabelText("Fim *"), "2026-12-01");
    await user.click(pendente.getByRole("button", { name: "Registrar programação" }));

    expect(
      await pendente.findByText("Férias que já começaram não podem ser reprogramadas."),
    ).toBeInTheDocument();
    expect(pendente.getByLabelText("Início *")).toHaveAttribute("aria-invalid", "true");
  });

  it("\"Não programar agora\" exige justificativa", async () => {
    vi.mocked(adiarProgramacao).mockResolvedValue(ferias());
    const user = usuario();
    renderModal();
    await screen.findByText(/2 períodos/);
    const pendente = card("Período 20/08/2025 a 19/08/2026");

    await user.click(pendente.getByRole("button", { name: "Não programar agora" }));
    await user.click(pendente.getByRole("button", { name: "Registrar" }));
    expect(await pendente.findByText("A justificativa é obrigatória.")).toBeInTheDocument();
    expect(adiarProgramacao).not.toHaveBeenCalled();

    await user.type(pendente.getByLabelText("Por que não programar agora? *"), "Campanha de periódicos.");
    await user.click(pendente.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(adiarProgramacao).toHaveBeenCalledWith(2, "Campanha de periódicos."));
  });

  it("\"RH acionado\" só com substituição ainda não acionada, e pede confirmação", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(
      ferias({ periodos_pendentes: [PROGRAMADO_COM_SUBSTITUICAO] }),
    );
    vi.mocked(registrarRhAcionado).mockResolvedValue(
      ferias({
        periodos_pendentes: [
          {
            ...PROGRAMADO_COM_SUBSTITUICAO,
            programacao: {
              ...PROGRAMADO_COM_SUBSTITUICAO.programacao!,
              rh_acionado_em: "2026-10-06T10:00:00-03:00",
              rh_acionado_por: "Coordenação Macaé",
            },
            pode_registrar_rh_acionado: false,
          },
        ],
      }),
    );
    const user = usuario();
    renderModal();

    const programado = await screen.findByRole("region", { name: "Período 20/08/2025 a 19/08/2026" });
    // Com as férias programadas, os marcos do período não disparam mais.
    expect(within(programado).getByText("sem alerta: férias programadas")).toBeInTheDocument();
    expect(within(programado).queryByRole("button", { name: "Não programar agora" })).not.toBeInTheDocument();

    await user.click(within(programado).getByRole("button", { name: "RH acionado" }));
    await user.click(await screen.findByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(registrarRhAcionado).toHaveBeenCalledWith(2));
    expect(await screen.findByText(/RH acionado em 06\/10\/2026 · 10:00 por Coordenação Macaé/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "RH acionado" })).not.toBeInTheDocument();
  });

  it("colaborador desligado: só leitura, sem ações", async () => {
    vi.mocked(buscarColaboradorRH).mockResolvedValue({ ...COLABORADOR, ativo: false });
    renderModal();

    expect(await screen.findByText("Desligado")).toBeInTheDocument();
    await screen.findByText(/2 períodos/);
    expect(screen.queryByRole("button", { name: "Programar férias" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Não programar agora" })).not.toBeInTheDocument();
  });

  it("histórico mostra os 5 mais recentes e abre o completo", async () => {
    const registros = Array.from({ length: 7 }, (_, indice) => ({
      acao: "periodo_ferias_criado",
      valor_anterior: "",
      valor_novo: `registro ${indice + 1}`,
      justificativa: "",
      regra_gatilho: "virada_de_periodo",
      por: null,
      automatico: true,
      em: `2026-10-0${7 - indice}T07:37:00-03:00`,
    }));
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(ferias({ historico: registros }));
    const user = usuario();
    renderModal();

    expect(await screen.findByText("Novo período de direito: registro 5")).toBeInTheDocument();
    expect(screen.queryByText("Novo período de direito: registro 6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver histórico completo (7)" }));
    expect(screen.getByText("Novo período de direito: registro 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver só os mais recentes" })).toBeInTheDocument();
  });

  it("histórico mostra o período quando a API informa", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue(
      ferias({
        historico: [
          {
            ...ferias().historico[0],
            periodo: { inicio_aquisitivo: "2025-08-20", fim_aquisitivo: "2026-08-19" },
          },
        ],
      }),
    );
    renderModal();

    expect(
      await screen.findByText("Alerta: antes do limite para tirar · período 2025/2026"),
    ).toBeInTheDocument();
  });

  it("histórico com texto legível e quem fez (ou automático)", async () => {
    renderModal();

    expect(await screen.findByText("Alerta: antes do limite para tirar")).toBeInTheDocument();
    expect(screen.getByText(/06\/10\/2026 · 07:37 · automático/)).toBeInTheDocument();
  });
});
