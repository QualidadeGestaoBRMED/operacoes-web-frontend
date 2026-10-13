import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
  EquipeVR,
  ParametrosAbsenteismoResposta,
  ReguaFeriasResposta,
  VersaoMarcoRegua,
  VersaoParametrosAbsenteismo,
} from "@/types/gestaoRH";
import { ParametrosGestaoRHAdmin } from "./ParametrosGestaoRHAdmin";

// Testes de férias: chave ligada (STC-687 desliga em produção nesta fase).
vi.mock("@/config/gestaoRH", () => ({ FERIAS_ATIVA: true }));
vi.mock("@/lib/gestaoRH", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRH")>()),
  buscarParametrosAbsenteismo: vi.fn(),
  salvarParametrosAbsenteismo: vi.fn(),
  buscarReguaFerias: vi.fn(),
  salvarReguaFerias: vi.fn(),
  listarEquipesVR: vi.fn(),
  reclassificarEquipeVR: vi.fn(),
}));
vi.mock("@/lib/plataforma", () => ({ listarUnidades: vi.fn(), listarUsuarios: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// A aba Importação (testada em AbaImportacao.test.tsx) busca o histórico ao montar.
vi.mock("@/lib/gestaoRHImportacao", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHImportacao")>()),
  listarImportacoes: vi.fn().mockResolvedValue([]),
}));

import { toast } from "sonner";
import {
  buscarParametrosAbsenteismo,
  buscarReguaFerias,
  listarEquipesVR,
  reclassificarEquipeVR,
  salvarParametrosAbsenteismo,
  salvarReguaFerias,
} from "@/lib/gestaoRH";
import { listarUnidades, listarUsuarios } from "@/lib/plataforma";

const VERSAO_INICIAL: VersaoParametrosAbsenteismo = {
  id: 1,
  limite_atraso_minutos: 15,
  tipos_computados: ["falta", "atestado"],
  meta_percentual: null,
  faixas: null,
  responsavel_tmo: null,
  responsavel_campanha: null,
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

const UNIDADES: Unidade[] = [
  { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" },
  { id: 2, nome: "Macaé", codigo: "MAC", cidade: "Macaé", ativa: true, rede: "padrao" },
  { id: 3, nome: "Fechada", codigo: "FEC", cidade: "Rio", ativa: false, rede: "padrao" },
];

function pessoa(id: number, first_name: string, comPerfil = true): Usuario {
  return {
    id,
    username: first_name.toLowerCase(),
    email: `${first_name.toLowerCase()}@grupobrmed.com.br`,
    first_name,
    last_name: "Silva",
    perfil: comPerfil ? { id: 2, nome: "Admin Operações", nivel: 2 } : null,
    unidade_id: null,
    setor_id: null,
    ativo: true,
    ultimo_acesso: null,
    foto_url: "",
  } as Usuario;
}

const USUARIOS: Usuario[] = [pessoa(7, "Carla"), pessoa(8, "Diego"), pessoa(9, "Sem", false)];

function equipe(extra: Partial<EquipeVR> = {}): EquipeVR {
  return {
    id: 10,
    nome: "Operações Niterói",
    categoria: "unidade",
    categoria_rotulo: "Unidade",
    unidade: { id: 1, nome: "Niterói" },
    colaboradores_ativos: 12,
    criada_na_importacao: null,
    ...extra,
  };
}

const EQUIPE_NOVA = {
  id: 11,
  nome: "Equipe nova",
  categoria: "sem_categoria",
  categoria_rotulo: "Sem categoria",
  unidade: null,
  colaboradores_ativos: 3,
} as const;

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
  vi.mocked(listarEquipesVR).mockResolvedValue([]);
  vi.mocked(listarUnidades).mockResolvedValue(UNIDADES);
  vi.mocked(listarUsuarios).mockResolvedValue(USUARIOS);
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
    expect(screen.getByRole("checkbox", { name: "Ausência" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Afastamento" })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() =>
      expect(salvarParametrosAbsenteismo).toHaveBeenCalledWith({
        limite_atraso_minutos: 15,
        meta_percentual: "5",
        faixas: { atencao_a_partir_de: "5", critica_acima_de: "8" },
        tipos_computados: ["falta", "atestado", "ausencia"],
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

    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
    expect(salvar).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
    expect(salvar).toBeDisabled();
  });

  it("desmarcar e marcar de novo um tipo não conta como alteração", async () => {
    // A API guarda os tipos na ordem recebida: pode devolver fora da ordem da tela.
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({ ...VERSAO_INICIAL, tipos_computados: ["atestado", "falta"] }),
    );
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");
    const salvar = screen.getByRole("button", { name: "Salvar nova versão" });

    await user.click(screen.getByRole("checkbox", { name: "Falta" }));
    await user.click(screen.getByRole("checkbox", { name: "Falta" }));
    expect(salvar).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Atestado" }));
    await user.click(screen.getByRole("checkbox", { name: "Atestado" }));
    expect(salvar).toBeDisabled();
  });

  it("voltar o limite ao valor original desabilita os botões de novo", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");
    const salvar = screen.getByRole("button", { name: "Salvar nova versão" });
    const limite = screen.getByLabelText("Limite de atraso e saída antecipada (minutos)");

    await user.clear(limite);
    await user.type(limite, "20");
    expect(salvar).toBeEnabled();

    await user.clear(limite);
    await user.type(limite, "15");
    expect(salvar).toBeDisabled();
  });

  it("falha ao carregar mostra o erro e permite tentar de novo", async () => {
    const user = userEvent.setup();
    vi.mocked(buscarParametrosAbsenteismo).mockRejectedValueOnce(new Error("Falha de rede"));
    renderTela({ shouldRetryOnError: false });

    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Versão inicial")).toBeInTheDocument();
  });

  it("falha numa revalidação mantém o formulário e a edição", async () => {
    const user = userEvent.setup();
    renderTela({ dedupingInterval: 0, focusThrottleInterval: 0, shouldRetryOnError: false });
    await screen.findByText("Versão inicial");
    await user.type(screen.getByLabelText("Meta de absenteísmo (%)"), "7");

    vi.mocked(buscarParametrosAbsenteismo).mockRejectedValue(new Error("Falha de rede"));
    vi.mocked(buscarReguaFerias).mockRejectedValue(new Error("Falha de rede"));
    fireEvent(window, new Event("focus"));

    await waitFor(() => expect(buscarParametrosAbsenteismo).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(buscarReguaFerias).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Meta de absenteísmo (%)")).toHaveValue(7);
    expect(screen.getByText("Régua de alertas de férias")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
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

    const erro = await screen.findByText("Obrigatório.");
    expect(erro).toHaveAttribute("role", "alert");
    const limite = screen.getByLabelText("Limite de atraso e saída antecipada (minutos)");
    expect(limite).toHaveAttribute("aria-invalid", "true");
    expect(limite).toHaveAccessibleDescription(/Obrigatório\./);
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
      erro400({ tipos_computados: ["Férias, afastamento e banco de horas nunca contam no absenteísmo."] }),
    );
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    expect(
      await screen.findByText("Férias, afastamento e banco de horas nunca contam no absenteísmo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("erro da API sem campo na tela vira toast", async () => {
    const user = userEvent.setup();
    vi.mocked(salvarParametrosAbsenteismo).mockRejectedValue(
      erro400({ non_field_errors: ["Parâmetros inválidos."] }),
    );
    renderTela();
    await screen.findByText("Versão inicial");

    await user.click(screen.getByRole("checkbox", { name: "Ausência" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Parâmetros inválidos."));
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
    await user.type(dias, "100");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const erro = await screen.findByText("Para este marco, os dias vão de 1 a 365.");
    const linhaDoMarco = screen
      .getByLabelText("Dias: dias antes do limite para tirar")
      .closest("li") as HTMLElement;
    expect(linhaDoMarco).toContainElement(erro);
  });
});

describe("Régua de férias: edição desfeita", () => {
  it("depois de desfazer, recebe a régua que outro Admin salvou", async () => {
    const user = userEvent.setup();
    renderTela({ dedupingInterval: 0, focusThrottleInterval: 0 });
    await screen.findByText("Régua de alertas de férias");
    const salvar = screen.getByRole("button", { name: "Salvar" });
    const completou = screen.getByRole("switch", { name: "Ativar: Completou o período de direito" });

    await user.click(completou);
    await user.click(completou);
    expect(salvar).toBeDisabled();

    // Outro Admin salvou 60 dias: a tela revalida ao voltar o foco.
    vi.mocked(buscarReguaFerias).mockResolvedValue({
      ...REGUA,
      marcos: REGUA.marcos.map((item) =>
        item.tipo_marco === "antes_do_limite" ? { ...item, dias: 60 } : item,
      ),
    });
    fireEvent(window, new Event("focus"));

    await waitFor(() =>
      expect(screen.getByLabelText("Dias: dias antes do limite para tirar")).toHaveValue(60),
    );
    expect(salvar).toBeDisabled();
  });
});

describe("Troca de aba", () => {
  it("ir à Importação e voltar mantém a edição", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Versão inicial");
    await user.type(screen.getByLabelText("Meta de absenteísmo (%)"), "7");
    const dias = screen.getByLabelText("Dias: dias antes do limite para tirar");
    await user.clear(dias);
    await user.type(dias, "60");

    await user.click(screen.getByRole("tab", { name: "Importação" }));
    expect(screen.getByLabelText("Meta de absenteísmo (%)")).not.toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Absenteísmo e férias" }));

    expect(screen.getByLabelText("Meta de absenteísmo (%)")).toHaveValue(7);
    expect(screen.getByLabelText("Dias: dias antes do limite para tirar")).toHaveValue(60);
  });
});

describe("Régua de férias: validação", () => {
  it.each([
    ["", "Informe os dias."],
    ["400", "Os dias vão de 1 a 365."],
  ])("dias %o não chegam à API", async (valor, mensagem) => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Régua de alertas de férias");

    const dias = screen.getByLabelText("Dias: dias antes do limite para tirar");
    await user.clear(dias);
    if (valor) await user.type(dias, valor);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: valor ? `Ativar: ${valor} dias antes do limite para tirar` : "Ativar: dias antes do limite para tirar",
      }),
    ).toBeInTheDocument();
    expect(dias).toHaveAttribute("aria-invalid", "true");
    expect(dias).toHaveAccessibleDescription(mensagem);
    expect(salvarReguaFerias).not.toHaveBeenCalled();
  });
});

describe("Responsáveis pelas equipes sem unidade", () => {
  it("mostra só usuários com perfil e envia só o que mudou", async () => {
    vi.mocked(salvarParametrosAbsenteismo).mockResolvedValue({
      dados: parametros({ ...VERSAO_INICIAL, responsavel_tmo: { id: 7, nome: "Carla Silva" } }),
      criouVersao: true,
    });
    const user = userEvent.setup();
    renderTela();

    await user.click(await screen.findByLabelText("TMO"));
    expect(await screen.findByRole("option", { name: "Carla Silva" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sem Silva" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Carla Silva" }));
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() =>
      expect(salvarParametrosAbsenteismo).toHaveBeenCalledWith(expect.objectContaining({ responsavel_tmo: 7 })),
    );
    // Campanha não mudou: vai ausente, e o backend mantém o atual.
    expect(vi.mocked(salvarParametrosAbsenteismo).mock.calls[0][0]).not.toHaveProperty("responsavel_campanha");
  });

  it("responsável atual desativado não trava o salvar de outro campo", async () => {
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({ ...VERSAO_INICIAL, responsavel_tmo: { id: 99, nome: "Ex Responsável" } }),
    );
    vi.mocked(salvarParametrosAbsenteismo).mockResolvedValue({ dados: parametros(VERSAO_INICIAL), criouVersao: true });
    const user = userEvent.setup();
    renderTela();

    const limite = await screen.findByLabelText("Limite de atraso e saída antecipada (minutos)");
    await user.clear(limite);
    await user.type(limite, "20");
    await user.click(screen.getByRole("button", { name: "Salvar nova versão" }));

    await waitFor(() => expect(salvarParametrosAbsenteismo).toHaveBeenCalled());
    expect(vi.mocked(salvarParametrosAbsenteismo).mock.calls[0][0]).not.toHaveProperty("responsavel_tmo");
  });

  it("responsável atual que saiu da lista continua aparecendo", async () => {
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({ ...VERSAO_INICIAL, responsavel_campanha: { id: 99, nome: "Ex Responsável" } }),
    );
    renderTela();
    const campo = await screen.findByLabelText("Campanha");
    await waitFor(() => expect(campo).toHaveTextContent("Ex Responsável"));
  });
});

describe("Responsáveis: falha ao carregar os usuários", () => {
  it("avisa e bloqueia a troca, sem esconder o responsável atual", async () => {
    vi.mocked(listarUsuarios).mockRejectedValue(new Error("rede"));
    vi.mocked(buscarParametrosAbsenteismo).mockResolvedValue(
      parametros({ ...VERSAO_INICIAL, responsavel_tmo: { id: 7, nome: "Carla Silva" } }),
    );
    renderTela();

    expect(await screen.findByText(/Não foi possível carregar os usuários/)).toBeInTheDocument();
    const campo = screen.getByLabelText("TMO");
    expect(campo).toBeDisabled();
    await waitFor(() => expect(campo).toHaveTextContent("Carla Silva"));
  });
});

describe("Aba Equipes", () => {
  async function abrirAba(user: ReturnType<typeof userEvent.setup>) {
    renderTela();
    await user.click(await screen.findByRole("tab", { name: "Equipes" }));
  }

  it("lista as equipes e avisa quantas estão sem categoria", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe(EQUIPE_NOVA), equipe()]);
    const user = userEvent.setup();
    await abrirAba(user);

    const tabela = await screen.findByRole("table", { name: "Equipes do VR" });
    expect(within(tabela).getByText("Operações Niterói")).toBeInTheDocument();
    expect(within(tabela).getByText("Sem categoria")).toBeInTheDocument();
    expect(screen.getByText(/1 equipe sem categoria: os colaboradores dela ficam fora do indicador/)).toBeInTheDocument();
  });

  it("tirar a unidade de uma equipe com colaboradores pede confirmação; cancelar não salva", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe()]);
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Categoria de Operações Niterói"));
    await user.click(await screen.findByRole("option", { name: "TMO" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(
      "Os 12 colaboradores de Operações Niterói deixam a unidade Niterói e passam para TMO",
    );

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(reclassificarEquipeVR).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Categoria de Operações Niterói")).toHaveTextContent("Unidade");
  });

  it("trocar a unidade de uma equipe com colaboradores salva depois de confirmar", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe()]);
    vi.mocked(reclassificarEquipeVR).mockResolvedValue(equipe({ unidade: { id: 2, nome: "Macaé" } }));
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Unidade de Operações Niterói"));
    await user.click(await screen.findByRole("option", { name: "Macaé" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("passam de Niterói para Macaé");
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(reclassificarEquipeVR).toHaveBeenCalledWith(10, { categoria: "unidade", unidade: 2 }));
    expect(toast.success).toHaveBeenCalledWith("Operações Niterói: Unidade · Macaé.");
  });

  it("equipe sem colaboradores muda de categoria na hora, sem unidade", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe({ colaboradores_ativos: 0 })]);
    vi.mocked(reclassificarEquipeVR).mockResolvedValue(
      equipe({ categoria: "tmo", categoria_rotulo: "TMO", unidade: null, colaboradores_ativos: 0 }),
    );
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Categoria de Operações Niterói"));
    await user.click(await screen.findByRole("option", { name: "TMO" }));

    await waitFor(() => expect(reclassificarEquipeVR).toHaveBeenCalledWith(10, { categoria: "tmo", unidade: null }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Operações Niterói: TMO.");
    expect(await screen.findByText("Sem unidade")).toBeInTheDocument();
  });

  it("classificar uma equipe sem categoria como Unidade espera a unidade e salva sem confirmar", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe(EQUIPE_NOVA)]);
    vi.mocked(reclassificarEquipeVR).mockResolvedValue(
      equipe({ id: 11, nome: "Equipe nova", unidade: { id: 2, nome: "Macaé" } }),
    );
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Categoria de Equipe nova"));
    await user.click(await screen.findByRole("option", { name: "Unidade" }));
    expect(reclassificarEquipeVR).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Unidade de Equipe nova"));
    // Unidade desativada não é oferecida.
    expect(screen.queryByRole("option", { name: "Fechada" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Macaé" }));

    await waitFor(() => expect(reclassificarEquipeVR).toHaveBeenCalledWith(11, { categoria: "unidade", unidade: 2 }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("erro da API aparece na linha da equipe", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe({ colaboradores_ativos: 0 })]);
    vi.mocked(reclassificarEquipeVR).mockRejectedValue(erro400({ unidade: ["Escolha a unidade da equipe."] }));
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Unidade de Operações Niterói"));
    await user.click(await screen.findByRole("option", { name: "Macaé" }));

    expect(await screen.findByText("Escolha a unidade da equipe.")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria de Operações Niterói")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Unidade de Operações Niterói")).toHaveAccessibleDescription(
      "Escolha a unidade da equipe.",
    );
  });

  it("gravação recusada deixa os campos com o que está salvo", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe(EQUIPE_NOVA), equipe({ colaboradores_ativos: 0 })]);
    vi.mocked(reclassificarEquipeVR).mockRejectedValue(erro400({ detail: "Falha ao salvar." }));
    const user = userEvent.setup();
    await abrirAba(user);

    await user.click(await screen.findByLabelText("Categoria de Equipe nova"));
    await user.click(await screen.findByRole("option", { name: "TMO" }));
    await waitFor(() => expect(screen.getAllByText("Falha ao salvar.")).toHaveLength(1));
    expect(screen.getByLabelText("Categoria de Equipe nova")).toHaveTextContent("Escolha a categoria");

    await user.click(screen.getByLabelText("Unidade de Operações Niterói"));
    await user.click(await screen.findByRole("option", { name: "Macaé" }));
    await waitFor(() => expect(screen.getAllByText("Falha ao salvar.")).toHaveLength(2));
    expect(screen.getByLabelText("Unidade de Operações Niterói")).toHaveTextContent("Niterói");
  });

  it("sem a lista de unidades, avisa e bloqueia a escolha da unidade", async () => {
    vi.mocked(listarUnidades).mockRejectedValue(new Error("rede"));
    vi.mocked(listarEquipesVR).mockResolvedValue([equipe()]);
    const user = userEvent.setup();
    await abrirAba(user);

    expect(await screen.findByText(/Não foi possível carregar as unidades do Atlas/)).toBeInTheDocument();
    expect(screen.getByLabelText("Unidade de Operações Niterói")).toBeDisabled();
  });

  it("filtra por categoria, com a contagem de cada uma", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([
      equipe(EQUIPE_NOVA),
      equipe(),
      equipe({ id: 12, nome: "TMO Rio", categoria: "tmo", categoria_rotulo: "TMO", unidade: null }),
    ]);
    const user = userEvent.setup();
    await abrirAba(user);

    const filtros = await screen.findByRole("group", { name: "Filtrar por categoria" });
    expect(within(filtros).getByRole("button", { name: "Todas, 3" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(filtros).getByRole("button", { name: "Sem categoria, 1" }));

    const tabela = screen.getByRole("table", { name: "Equipes do VR" });
    expect(within(tabela).getByText("Equipe nova")).toBeInTheDocument();
    expect(within(tabela).queryByText("Operações Niterói")).not.toBeInTheDocument();
    expect(within(tabela).queryByText("TMO Rio")).not.toBeInTheDocument();

    await user.click(within(filtros).getByRole("button", { name: "Campanha, 0" }));
    expect(screen.getByText("Nenhuma equipe encontrada com esse filtro.")).toBeInTheDocument();
  });

  it("busca pelo nome sem acento", async () => {
    vi.mocked(listarEquipesVR).mockResolvedValue([
      equipe(),
      equipe({ id: 12, nome: "TMO Rio", categoria: "tmo", categoria_rotulo: "TMO", unidade: null }),
    ]);
    const user = userEvent.setup();
    await abrirAba(user);

    await user.type(await screen.findByLabelText("Buscar equipe"), "niteroi");
    expect(screen.getByText("Operações Niterói")).toBeInTheDocument();
    expect(screen.queryByText("TMO Rio")).not.toBeInTheDocument();
  });
});
