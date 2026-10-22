import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AbsenteismoColaborador, CabecalhoColaborador } from "@/types/gestaoRH";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";

// Testes de férias: chave ligada (STC-687 desliga em produção nesta fase).
vi.mock("@/config/gestaoRH", () => ({ FERIAS_ATIVA: true }));
vi.mock("@/lib/gestaoRHFerias", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHFerias")>()),
  buscarColaboradorRH: vi.fn(),
  buscarFeriasColaborador: vi.fn(),
}));
vi.mock("@/lib/gestaoRHAbsenteismo", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHAbsenteismo")>()),
  buscarAbsenteismoColaborador: vi.fn(),
  registrarTratamento: vi.fn(),
}));
vi.mock("@/lib/demandas", async (original) => ({
  ...(await original<typeof import("@/lib/demandas")>()),
  listarComentarios: vi.fn(),
  criarComentario: vi.fn(),
  buscarDemanda: vi.fn(),
  listarAnexos: vi.fn(),
  enviarAnexo: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// A lista de anexos usa o usuário logado só para oferecer o botão de remover.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { usuarioId: 1 } }) }));

import { toast } from "sonner";
import { buscarAbsenteismoColaborador, registrarTratamento } from "@/lib/gestaoRHAbsenteismo";
import {
  buscarDemanda,
  criarComentario,
  enviarAnexo,
  listarAnexos,
  listarComentarios,
} from "@/lib/demandas";
import { criarDemanda } from "@/test-utils/fixtures";
import type { Anexo, Comentario } from "@/types";
import { buscarColaboradorRH, buscarFeriasColaborador } from "@/lib/gestaoRHFerias";

const COLABORADOR: CabecalhoColaborador = {
  id: 8,
  nome: "Juliana Ramos",
  matricula_vr: "004512",
  cargo: "Técnica de Enfermagem",
  unidade: { id: 1, nome: "Niterói" },
  data_admissao: "2024-03-12",
  ativo: true,
  alertas_pendentes: { ferias: 0, absenteismo: 1 },
};

const SETEMBRO = { inicio: "2026-09-01", fim: "2026-09-30" };

function aba(extra: Partial<AbsenteismoColaborador> = {}): AbsenteismoColaborador {
  return {
    periodo: SETEMBRO,
    parametros: { faixas_cadastradas: true, limite_atraso_minutos: 15, vigente_a_partir_de: null },
    indicadores: {
      percentual: "13.60",
      faixa: "critica",
      provisorio: true,
      pendencias: 2,
      dias_trabalhados: 15,
      dias_previstos: 21,
      conformidade_percentual: "72.00",
      banco_horas_saldo_minutos: -220,
      banco_horas_uso_minutos: 120,
    },
    ocorrencias: [
      { tipo: "falta", inicio: "2026-09-04", fim: "2026-09-04", dias: 1, minutos: null, conta_no_absenteismo: true, em_aprovacao: false, justificada: false },
      { tipo: "afastamento", inicio: "2026-09-10", fim: "2026-09-11", dias: 2, minutos: null, conta_no_absenteismo: false, em_aprovacao: false, justificada: null },
      { tipo: "saida_antecipada", inicio: "2026-09-22", fim: "2026-09-22", dias: null, minutos: 20, conta_no_absenteismo: null, em_aprovacao: true, justificada: null },
    ],
    alertas: [
      {
        id: 9,
        periodo_inicio: "2026-09-01",
        periodo_fim: "2026-09-30",
        faixa: "critica",
        critica_acima_de: null,
        provisorio: false,
        gerado_em: "2026-10-01T06:00:00-03:00",
        demanda_id: 41,
        demanda_aberta: true,
        responsavel: "Coordenação Niterói",
        pode_registrar_tratamento: true,
        tratamento: null,
      },
    ],
    historico: [],
    ...extra,
  };
}

const TRATADA = aba({
  alertas: [
    {
      ...aba().alertas[0],
      demanda_aberta: false,
      pode_registrar_tratamento: false,
      tratamento: { acao: "feedback", justificativa: "Conversa sobre as faltas.", por: "Coordenação Niterói", em: "2026-10-06T10:00:00-03:00" },
    },
  ],
});

// Um provider por teste, fora do JSX: rerender() mantém o mesmo cache.
let cacheSWR = new Map();

function modalCom(props: Partial<Parameters<typeof DetalheColaboradorModal>[0]> = {}) {
  return (
    <SWRConfig value={{ provider: () => cacheSWR, dedupingInterval: 0, shouldRetryOnError: false }}>
      <DetalheColaboradorModal
        colaboradorId={8}
        periodoEmFoco={null}
        abaInicial="absenteismo"
        periodoAbsenteismo={SETEMBRO}
        onFechar={vi.fn()}
        {...props}
      />
    </SWRConfig>
  );
}

function renderModal(props: Partial<Parameters<typeof DetalheColaboradorModal>[0]> = {}) {
  cacheSWR = new Map();
  return render(modalCom(props));
}

function usuario() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.mocked(buscarColaboradorRH).mockResolvedValue(COLABORADOR);
  vi.mocked(buscarAbsenteismoColaborador).mockReset();
  vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(aba());
  vi.mocked(registrarTratamento).mockReset();
  vi.mocked(listarComentarios).mockReset();
  vi.mocked(listarComentarios).mockResolvedValue([]);
  vi.mocked(criarComentario).mockReset();
  vi.mocked(buscarDemanda).mockReset();
  vi.mocked(buscarDemanda).mockResolvedValue(criarDemanda({ id: 41, status: "em_andamento" }));
  vi.mocked(listarAnexos).mockReset();
  vi.mocked(listarAnexos).mockResolvedValue([]);
  vi.mocked(enviarAnexo).mockReset();
});

function comentario(id: number, texto: string, nome = "Ana Admin"): Comentario {
  const [first_name, last_name] = nome.split(" ");
  return {
    id,
    texto,
    created_at: "2026-10-06T10:00:00-03:00",
    usuario: {
      id: 100 + id,
      username: nome,
      email: "",
      first_name,
      last_name,
      perfil: null,
      unidade_id: null,
      setor_id: null,
      ativo: true,
      ultimo_acesso: null,
      foto_url: "",
    },
  };
}

const AVISO_SAUDE = "Não registre diagnóstico, CID ou outros dados de saúde.";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Modal do colaborador · aba Absenteísmo", () => {
  it("abre na aba Absenteísmo, antes de Férias, no período recebido; Férias nem carrega", async () => {
    renderModal();

    expect(await screen.findByText("Ocorrências do período")).toBeInTheDocument();
    const abas = screen.getAllByRole("tab");
    expect(abas.map((aba) => aba.textContent)).toEqual(["Absenteísmo1 alerta", "Férias"]);
    expect(abas[0]).toHaveAttribute("aria-selected", "true");
    expect(buscarAbsenteismoColaborador).toHaveBeenCalledWith(8, SETEMBRO);
    expect(buscarFeriasColaborador).not.toHaveBeenCalled();
  });

  it("aberto pelo Painel de Férias, continua na aba Férias", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue({
      periodos_pendentes: [],
      ferias_tiradas: [],
      periodo_em_andamento: null,
      dias_antes_do_inicio_substituicao: 40,
      historico: [],
    });
    renderModal({ abaInicial: "ferias", periodoAbsenteismo: null });

    expect(await screen.findByText("Nenhum período com férias pendentes.")).toBeInTheDocument();
    expect(buscarAbsenteismoColaborador).not.toHaveBeenCalled();
  });

  it("ir para Férias e voltar mantém o formulário de tratamento preenchido", async () => {
    vi.mocked(buscarFeriasColaborador).mockResolvedValue({
      periodos_pendentes: [],
      ferias_tiradas: [],
      periodo_em_andamento: null,
      dias_antes_do_inicio_substituicao: 40,
      historico: [],
    });
    const user = usuario();
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    await user.type(alerta.getByLabelText("Justificativa *"), "Rascunho da conversa.");

    await user.click(screen.getByRole("tab", { name: /Férias/ }));
    expect(await screen.findByText("Nenhum período com férias pendentes.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Absenteísmo/ }));

    expect(screen.getByLabelText("Justificativa *")).toHaveValue("Rascunho da conversa.");
    expect(buscarAbsenteismoColaborador).toHaveBeenCalledTimes(1);
  });

  it("indicadores, aviso de justificativas pendentes e ocorrências com o que conta e o que está pendente no VR", async () => {
    renderModal();
    await screen.findByText("Ocorrências do período");

    expect(screen.getByText(/2 justificativas pendentes no VR, aguardando aprovação no SuperApp/)).toBeInTheDocument();
    expect(screen.getByText("13,6%")).toBeInTheDocument();
    expect(screen.getByText("faixa crítica · provisório")).toBeInTheDocument();
    expect(screen.getByText("15 de 21")).toBeInTheDocument();
    expect(screen.getByText("-03:40")).toBeInTheDocument();

    const falta = screen.getByText(/Falta sem justificativa/).closest("li") as HTMLElement;
    expect(within(falta).getByText("conta no absenteísmo")).toBeInTheDocument();
    const afastamento = screen.getByText(/Afastamento · 2 dias/).closest("li") as HTMLElement;
    expect(within(afastamento).getByText("10/09/2026 a 11/09/2026")).toBeInTheDocument();
    expect(within(afastamento).getByText("não conta no absenteísmo")).toBeInTheDocument();
    const saida = screen.getByText(/Saída antecipada de 20 minutos/).closest("li") as HTMLElement;
    expect(within(saida).getByText("acima de 15 min")).toBeInTheDocument();
    expect(within(saida).getByText("pendente no VR")).toBeInTheDocument();
    expect(screen.getByText("Atestados aparecem só com tipo e período, sem dados clínicos.")).toBeInTheDocument();
  });

  it("STC-767: alerta diz com que limite da crítica foi gerado; sem a versão, não diz", async () => {
    const [alerta] = aba().alertas;
    vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(
      aba({ alertas: [{ ...alerta, critica_acima_de: 10 }] }),
    );
    renderModal();
    expect(await screen.findByText(/crítica acima de 10% quando gerado/)).toBeInTheDocument();
  });

  it("STC-767: alerta sem a versão que o gerou, ou sem o campo (backend anterior), não mostra limite", async () => {
    const [alerta] = aba().alertas;
    const semCampo = { ...alerta };
    delete semCampo.critica_acima_de;
    vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(aba({ alertas: [semCampo] }));
    renderModal();
    await screen.findByText("Ocorrências do período");
    expect(screen.queryByText(/quando gerado/)).not.toBeInTheDocument();
  });

  it("registrar tratamento exige ação e justificativa e envia o alerta", async () => {
    vi.mocked(registrarTratamento).mockResolvedValue(TRATADA);
    const user = usuario();
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    expect(alerta.getByText(/Demanda aberta em 01\/10\/2026 · responsável: Coordenação Niterói/)).toBeInTheDocument();

    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    expect(alerta.getByText("Escolha a ação tomada.")).toBeInTheDocument();
    expect(alerta.getByText("A justificativa é obrigatória.")).toBeInTheDocument();
    expect(registrarTratamento).not.toHaveBeenCalled();

    await user.click(alerta.getByLabelText("Ação tomada *"));
    await user.click(await screen.findByRole("option", { name: "Feedback" }));
    await user.type(alerta.getByLabelText("Justificativa *"), "Conversa sobre as faltas.");
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));

    await waitFor(() =>
      expect(registrarTratamento).toHaveBeenCalledWith(8, {
        alerta: 9,
        acao: "feedback",
        justificativa: "Conversa sobre as faltas.",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Tratamento registrado.");
    expect(await screen.findByText("Tratamento: Feedback")).toBeInTheDocument();
    expect(screen.getByText(/demanda concluída/)).toBeInTheDocument();
  });

  it("com outro período na tela, o tratamento busca de novo esse período em vez de mostrar o do alerta", async () => {
    const AGOSTO_A_SETEMBRO = { inicio: "2026-08-01", fim: "2026-09-30" };
    vi.mocked(buscarAbsenteismoColaborador).mockImplementation(async (_id, periodo) =>
      aba({ periodo, indicadores: { ...aba().indicadores, percentual: periodo.inicio === "2026-08-01" ? "9.00" : "13.60" } }),
    );
    vi.mocked(registrarTratamento).mockResolvedValue(TRATADA);
    const user = usuario();
    renderModal({ periodoAbsenteismo: AGOSTO_A_SETEMBRO });
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    expect(screen.getByText("9%")).toBeInTheDocument();
    const antes = vi.mocked(buscarAbsenteismoColaborador).mock.calls.length;

    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    await user.click(alerta.getByLabelText("Ação tomada *"));
    await user.click(await screen.findByRole("option", { name: "Feedback" }));
    await user.type(alerta.getByLabelText("Justificativa *"), "Conversa.");
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));

    await waitFor(() =>
      expect(vi.mocked(buscarAbsenteismoColaborador).mock.calls.length).toBeGreaterThan(antes),
    );
    expect(vi.mocked(buscarAbsenteismoColaborador).mock.lastCall?.[1]).toEqual(AGOSTO_A_SETEMBRO);
    expect(screen.getByText("9%")).toBeInTheDocument();
  });

  it("erro da API no tratamento aparece no campo", async () => {
    vi.mocked(registrarTratamento).mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { justificativa: ["Justificativa longa demais."] },
      } as AxiosResponse),
    );
    const user = usuario();
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));

    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    await user.click(alerta.getByLabelText("Ação tomada *"));
    await user.click(await screen.findByRole("option", { name: "Advertência" }));
    await user.type(alerta.getByLabelText("Justificativa *"), "Texto.");
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));

    expect(await alerta.findByText("Justificativa longa demais.")).toBeInTheDocument();
    expect(alerta.getByLabelText("Justificativa *")).toHaveAttribute("aria-invalid", "true");
  });

  it("alerta encerrado pela importação aparece encerrado, sem registrar", async () => {
    vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(
      aba({ alertas: [{ ...aba().alertas[0], demanda_aberta: false, pode_registrar_tratamento: false }] }),
    );
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    expect(alerta.getByText(/Encerrado: saiu da faixa crítica depois de uma nova importação/)).toBeInTheDocument();
    expect(alerta.getByText(/demanda concluída/)).toBeInTheDocument();
    expect(alerta.queryByRole("button", { name: "Registrar tratamento" })).not.toBeInTheDocument();
  });

  it("alerta provisório e responsável das equipes sem unidade", async () => {
    vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(
      aba({ alertas: [{ ...aba().alertas[0], provisorio: true, responsavel: "Admins" }] }),
    );
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    expect(alerta.getByText("Provisório")).toBeInTheDocument();
    expect(alerta.getByText(/responsável: Admins/)).toBeInTheDocument();
  });

  it("alerta já fechado por outra pessoa: mostra o erro e recarrega a aba", async () => {
    vi.mocked(registrarTratamento).mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { alerta: "Este alerta já foi tratado ou encerrado." },
      } as AxiosResponse),
    );
    const user = usuario();
    renderModal();
    const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
    vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(TRATADA);

    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));
    await user.click(alerta.getByLabelText("Ação tomada *"));
    await user.click(await screen.findByRole("option", { name: "Feedback" }));
    await user.type(alerta.getByLabelText("Justificativa *"), "Conversa.");
    const cabecalhos = vi.mocked(buscarColaboradorRH).mock.calls.length;
    await user.click(alerta.getByRole("button", { name: "Registrar tratamento" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este alerta já foi tratado ou encerrado."));
    expect(await screen.findByText("Tratamento: Feedback")).toBeInTheDocument();
    // O cabeçalho (alertas pendentes) também é buscado de novo.
    await waitFor(() => expect(vi.mocked(buscarColaboradorRH).mock.calls.length).toBeGreaterThan(cabecalhos));
    expect(screen.queryByLabelText("Justificativa *")).not.toBeInTheDocument();
  });

  it("com o colaborador desligado, não oferece registrar", async () => {
    vi.mocked(buscarColaboradorRH).mockResolvedValue({ ...COLABORADOR, ativo: false });
    renderModal();
    await screen.findByRole("region", { name: "Alerta de setembro/2026" });
    expect(screen.queryByRole("button", { name: "Registrar tratamento" })).not.toBeInTheDocument();
  });

  it("aberto pelo card do Kanban, rola até o alerta do período e leva o foco a ele", async () => {
    renderModal({ focarAlertaAbsenteismo: true });

    const alerta = await screen.findByRole("region", { name: "Alerta de setembro/2026" });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(alerta);
    expect(alerta).toHaveFocus();
  });

  it("trocar o período busca de novo; período inválido não busca", async () => {
    const user = usuario();
    renderModal();
    await screen.findByText("Ocorrências do período");

    await user.clear(screen.getByLabelText("Período"));
    await user.type(screen.getByLabelText("Período"), "2026-08-01");
    await waitFor(() =>
      expect(buscarAbsenteismoColaborador).toHaveBeenLastCalledWith(8, { inicio: "2026-08-01", fim: "2026-09-30" }),
    );
    const chamadas = vi.mocked(buscarAbsenteismoColaborador).mock.calls.length;

    await user.clear(screen.getByLabelText("até"));
    await user.type(screen.getByLabelText("até"), "2026-07-01");
    expect(screen.getByText("Informe início e fim, com o fim depois do início.")).toBeInTheDocument();
    expect(vi.mocked(buscarAbsenteismoColaborador).mock.calls.length).toBe(chamadas);
  });

  it("falha ao trocar de período avisa de qual período são os dados na tela", async () => {
    const user = usuario();
    renderModal();
    await screen.findByText("Ocorrências do período");
    vi.mocked(buscarAbsenteismoColaborador).mockRejectedValueOnce(new Error("Falha de rede"));

    await user.clear(screen.getByLabelText("Período"));
    await user.type(screen.getByLabelText("Período"), "2026-08-01");

    expect(
      await screen.findByText(/Não foi possível carregar o período escolhido\. Os dados abaixo são de 01\/09\/2026 a 30\/09\/2026/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() =>
      expect(screen.queryByText(/Não foi possível carregar o período escolhido/)).not.toBeInTheDocument(),
    );
  });

  it("falha ao carregar oferece tentar de novo", async () => {
    vi.mocked(buscarAbsenteismoColaborador).mockRejectedValueOnce(new Error("Falha de rede"));
    const user = usuario();
    renderModal();

    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ocorrências do período")).toBeInTheDocument();
  });
  describe("anexos da demanda", () => {
    const AVISO_ANEXOS = "Não anexe atestado ou documento com informação de saúde.";
    const anexo = (id: number, nome: string): Anexo => ({
      id,
      usuario: comentario(id, "", "Carla Coord").usuario,
      arquivo: `/media/anexos/${nome}`,
      nome_original: nome,
      tamanho: 2048,
      created_at: "2026-10-06T10:00:00-03:00",
    });

    async function abrirAnexos(user: ReturnType<typeof usuario>, anexos = "0 anexos") {
      const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
      await user.click(await alerta.findByRole("button", { name: `Anexos da demanda, ${anexos}` }));
      return within(screen.getByRole("region", { name: "Anexos · Alerta de setembro/2026" }));
    }

    it("botão com a contagem abre a lista, a orientação e o envio", async () => {
      vi.mocked(listarAnexos).mockResolvedValue([anexo(1, "advertencia.pdf")]);
      vi.mocked(enviarAnexo).mockResolvedValue(anexo(2, "desligamento.pdf"));
      const user = usuario();
      renderModal();

      const painel = await abrirAnexos(user, "1 anexo");
      expect(await painel.findByText("advertencia.pdf")).toBeInTheDocument();
      expect(listarAnexos).toHaveBeenCalledWith(41);
      expect(painel.getByText(AVISO_ANEXOS)).toBeInTheDocument();
      expect(painel.getByRole("heading", { name: "Anexos · Alerta de setembro/2026" })).toHaveFocus();

      const arquivo = new File(["%PDF"], "desligamento.pdf", { type: "application/pdf" });
      await user.click(await painel.findByRole("button", { name: "Adicionar anexo" }));
      await user.upload(
        document.querySelector<HTMLInputElement>('input[type="file"]')!,
        arquivo,
      );
      await waitFor(() => expect(enviarAnexo).toHaveBeenCalledWith(41, arquivo, expect.any(Function)));
    });

    it("demanda concluída pelo tratamento continua aceitando anexo", async () => {
      vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(TRATADA);
      vi.mocked(buscarDemanda).mockResolvedValue(criarDemanda({ id: 41, status: "concluido" }));
      const user = usuario();
      renderModal();

      const painel = await abrirAnexos(user);
      expect(await painel.findByRole("button", { name: "Adicionar anexo" })).toBeInTheDocument();
    });

    it("voltar fecha a lista e mantém a aba", async () => {
      const user = usuario();
      renderModal();
      const painel = await abrirAnexos(user);

      await user.click(painel.getByRole("button", { name: "Voltar" }));
      expect(screen.queryByRole("region", { name: "Anexos · Alerta de setembro/2026" })).not.toBeInTheDocument();
      expect(screen.getByText("Ocorrências do período")).toBeInTheDocument();
    });
  });

  describe("conversa da demanda", () => {
    async function abrirConversa(user: ReturnType<typeof usuario>, comentarios = "0 comentários") {
      const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));
      const botao = await alerta.findByRole("button", { name: `Conversa da demanda, ${comentarios}` });
      await user.click(botao);
      return { botao, painel: within(screen.getByRole("region", { name: "Conversa · Alerta de setembro/2026" })) };
    }

    it("botão com a contagem abre o painel com a lista, o aviso e o envio", async () => {
      vi.mocked(listarComentarios).mockResolvedValue([comentario(1, "Pode verificar as faltas?")]);
      vi.mocked(criarComentario).mockResolvedValue(comentario(2, "Conversei com ela.", "Carla Coord"));
      const user = usuario();
      renderModal();

      const { painel } = await abrirConversa(user, "1 comentário");
      expect(await painel.findByText("Pode verificar as faltas?")).toBeInTheDocument();
      expect(listarComentarios).toHaveBeenCalledWith(41);
      expect(painel.getByText(AVISO_SAUDE)).toBeInTheDocument();
      // O aviso é lido junto com o campo por leitor de tela.
      expect(painel.getByPlaceholderText(/Adicionar comentário/)).toHaveAccessibleDescription(AVISO_SAUDE);
      expect(painel.getByRole("heading", { name: "Conversa · Alerta de setembro/2026" })).toHaveFocus();

      await user.type(painel.getByPlaceholderText(/Adicionar comentário/), "Conversei com ela.");
      await user.click(painel.getByRole("button", { name: "Enviar" }));
      await waitFor(() => expect(criarComentario).toHaveBeenCalledWith(41, "Conversei com ela."));
    });

    it("voltar fecha o painel, mantém a aba e devolve o foco ao botão", async () => {
      const user = usuario();
      renderModal();
      const { botao, painel } = await abrirConversa(user);

      await user.click(painel.getByRole("button", { name: "Voltar" }));
      expect(screen.queryByRole("region", { name: "Conversa · Alerta de setembro/2026" })).not.toBeInTheDocument();
      expect(screen.getByText("Ocorrências do período")).toBeInTheDocument();
      await waitFor(() => expect(botao).toHaveFocus());
    });

    it("fechar o modal com a conversa aberta e reabrir volta para a aba", async () => {
      const user = usuario();
      const { rerender } = renderModal();
      await abrirConversa(user);

      rerender(modalCom({ colaboradorId: null }));
      rerender(modalCom({}));

      expect(await screen.findByRole("region", { name: "Alerta de setembro/2026" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Conversa · Alerta de setembro/2026" })).not.toBeInTheDocument();
    });

    it("vale a situação da própria demanda: concluída depois que a aba carregou, só leitura", async () => {
      // A aba ainda diz "demanda aberta", mas outra pessoa já concluiu.
      vi.mocked(buscarDemanda).mockResolvedValue(criarDemanda({ id: 41, status: "concluido" }));
      const user = usuario();
      renderModal();
      const { painel } = await abrirConversa(user);

      expect(await painel.findByText(/Demanda concluída: a conversa fica só para leitura/)).toBeInTheDocument();
      expect(painel.queryByPlaceholderText(/Adicionar comentário/)).not.toBeInTheDocument();
      expect(buscarDemanda).toHaveBeenCalledWith(41);
    });

    it("Esc volta da conversa para a aba sem fechar o modal; um segundo Esc fecha", async () => {
      const onFechar = vi.fn();
      const user = usuario();
      renderModal({ onFechar });
      const { botao } = await abrirConversa(user);

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("region", { name: "Conversa · Alerta de setembro/2026" })).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Alerta de setembro/2026" })).toBeInTheDocument();
      expect(onFechar).not.toHaveBeenCalled();
      await waitFor(() => expect(botao).toHaveFocus());

      await user.keyboard("{Escape}");
      expect(onFechar).toHaveBeenCalled();
    });

    it("demanda concluída: conversa só leitura", async () => {
      vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(TRATADA);
      vi.mocked(buscarDemanda).mockResolvedValue(criarDemanda({ id: 41, status: "concluido" }));
      vi.mocked(listarComentarios).mockResolvedValue([comentario(1, "Resolvido.")]);
      const user = usuario();
      renderModal();

      const { painel } = await abrirConversa(user, "1 comentário");
      expect(await painel.findByText("Resolvido.")).toBeInTheDocument();
      expect(painel.getByText(/Demanda concluída: a conversa fica só para leitura/)).toBeInTheDocument();
      expect(painel.queryByPlaceholderText(/Adicionar comentário/)).not.toBeInTheDocument();
      expect(painel.queryByText(AVISO_SAUDE)).not.toBeInTheDocument();
    });

    it("sem a lista de comentários (falhou), o botão não mostra número", async () => {
      vi.mocked(listarComentarios).mockRejectedValue(new Error("Falha de rede"));
      renderModal();
      const alerta = within(await screen.findByRole("region", { name: "Alerta de setembro/2026" }));

      const botao = await alerta.findByRole("button", { name: "Conversa da demanda" });
      await waitFor(() => expect(listarComentarios).toHaveBeenCalled());
      expect(botao).toHaveTextContent(/^Conversa$/);
    });

    it("alerta sem demanda não tem conversa", async () => {
      vi.mocked(buscarAbsenteismoColaborador).mockResolvedValue(
        aba({ alertas: [{ ...aba().alertas[0], demanda_id: null, demanda_aberta: false }] }),
      );
      renderModal();
      await screen.findByRole("region", { name: "Alerta de setembro/2026" });
      expect(screen.queryByRole("button", { name: /Conversa da demanda/ })).not.toBeInTheDocument();
      expect(listarComentarios).not.toHaveBeenCalled();
    });
  });
});
