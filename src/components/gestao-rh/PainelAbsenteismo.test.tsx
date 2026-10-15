import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useUnidades } from "@/hooks/useUnidades";
import { painelAbsenteismoDeExemplo } from "@/test-utils/painelAbsenteismoExemplo";
import type { AbsenteismoMensal, PainelAbsenteismo as Painel } from "@/types/gestaoRH";
import { PainelAbsenteismo } from "./PainelAbsenteismo";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/gestao-rh",
  useSearchParams: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useUnidades", () => ({ useUnidades: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/useAlturaSemLinhaCortada", () => ({
  useAlturaSemLinhaCortada: () => ({
    refPai: { current: null },
    refTabela: { current: null },
    maxHeight: undefined,
  }),
}));
vi.mock("@/lib/gestaoRHAbsenteismo", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHAbsenteismo")>()),
  buscarPainelAbsenteismo: vi.fn(),
  buscarAbsenteismoMensal: vi.fn(),
}));
vi.mock("./DetalheColaboradorModal", () => ({
  DetalheColaboradorModal: ({
    colaboradorId,
    abaInicial,
    periodoAbsenteismo,
    focarAlertaAbsenteismo,
  }: {
    colaboradorId: number | null;
    abaInicial?: string;
    periodoAbsenteismo?: { inicio: string; fim: string } | null;
    focarAlertaAbsenteismo?: boolean;
  }) => (
    <div data-testid="modal">
      {colaboradorId ?? "fechado"}|{abaInicial}|{periodoAbsenteismo?.inicio}..{periodoAbsenteismo?.fim}|
      {focarAlertaAbsenteismo ? "foco" : "sem-foco"}
    </div>
  ),
}));

import { buscarAbsenteismoMensal, buscarPainelAbsenteismo } from "@/lib/gestaoRHAbsenteismo";

const replace = vi.fn();
// Os mesmos dados de exemplo do ambiente local, que seguem o contrato da STC-588.
const PAINEL: Painel = painelAbsenteismoDeExemplo({ inicio: "2026-09-01", fim: "2026-09-30" });

function renderPainel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <PainelAbsenteismo />
    </SWRConfig>,
  );
}

function usuario() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

// O Painel busca também o período anterior, para o comparativo (agosto,
// com o padrão em setembro): as buscas da tabela são as de setembro.
function buscasDoPeriodo(inicio = "2026-09-01") {
  return vi
    .mocked(buscarPainelAbsenteismo)
    .mock.calls.map(([filtros]) => filtros)
    .filter((filtros) => filtros.inicio === inicio);
}

function ultimaBusca() {
  return buscasDoPeriodo().at(-1);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(useAuth).mockReturnValue({ isAdminOps: true } as ReturnType<typeof useAuth>);
  vi.mocked(useUnidades).mockReturnValue({
    unidades: [{ id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" }],
    isLoading: false,
    error: undefined,
  });
  vi.mocked(buscarPainelAbsenteismo).mockReset();
  vi.mocked(buscarAbsenteismoMensal).mockReset();
  vi.mocked(buscarPainelAbsenteismo).mockResolvedValue(PAINEL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Painel de Absenteísmo", () => {
  it("abre no mês anterior fechado, com cards, limite e data dos dados", async () => {
    renderPainel();

    expect(await screen.findByText("Juliana Ramos")).toBeInTheDocument();
    // Uma busca só, já com o filtro padrão de faixa (sem lista completa antes).
    expect(buscasDoPeriodo()).toHaveLength(1);
    expect(buscasDoPeriodo()[0]).toEqual({
      inicio: "2026-09-01",
      fim: "2026-09-30",
      unidade: undefined,
      faixa: ["critica", "atencao"],
      ocorrencia: undefined,
      com_pendencias: undefined,
    });
    expect(screen.getByText("limite: 5%")).toBeInTheDocument();
    expect(screen.getByText(/dados até 30\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Faixa crítica")).toBeInTheDocument();
    expect(screen.getByText("8 colaboradores")).toBeInTheDocument();
  });

  it("linha: percentual com faixa, provisório, ocorrências e banco de horas", async () => {
    renderPainel();

    const juliana = within((await screen.findByText("Juliana Ramos")).closest("tr") as HTMLElement);
    expect(juliana.getByText("13,6%")).toBeInTheDocument();
    expect(juliana.getByText("Crítica")).toBeInTheDocument();
    expect(juliana.getByText("provisório · 2 pendentes")).toHaveAttribute(
      "title",
      "2 justificativas pendentes no VR",
    );
    expect(juliana.getByText("15 de 21")).toBeInTheDocument();
    expect(juliana.getByText("2 faltas · 1 atestado")).toBeInTheDocument();
    expect(juliana.getByText(/1 atraso · 1 saída antecipada/)).toBeInTheDocument();
    expect(juliana.getByText("-03:40")).toBeInTheDocument();

    const marcos = within(screen.getByText("Marcos Lima").closest("tr") as HTMLElement);
    // Sem dia previsto no período: traço em dias, percentual e conformidade.
    expect(marcos.getAllByText("—")).toHaveLength(3);
    expect(marcos.getByText("Nenhuma")).toBeInTheDocument();
  });

  it("com faixas cadastradas, abre filtrando crítica e atenção; \"Todas\" mostra todos", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["critica", "atencao"]));
    expect(screen.getByLabelText("Faixa")).toHaveTextContent("Crítica e atenção");

    await user.click(screen.getByLabelText("Faixa"));
    await user.click(await screen.findByRole("option", { name: "Todas as faixas" }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toBeUndefined());
    // A escolha da pessoa vale: o filtro padrão não volta.
    await user.click(screen.getByRole("checkbox", { name: "Com justificativa pendente" }));
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));
    expect(ultimaBusca()?.faixa).toBeUndefined();
  });

  it("sem faixas cadastradas: sem cards, filtro e selo de faixa; sem meta, avisa", async () => {
    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue({
      ...PAINEL,
      parametros: { meta_percentual: null, faixas_cadastradas: false, limite_atraso_minutos: 15 },
      linhas: PAINEL.linhas.map((linha) => ({ ...linha, faixa: null })),
    });
    renderPainel();
    await screen.findByText("Juliana Ramos");

    expect(screen.queryByText("Faixa crítica")).not.toBeInTheDocument();
    expect(screen.queryByText("Faixa de atenção")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Faixa")).not.toBeInTheDocument();
    expect(screen.queryByText("Crítica")).not.toBeInTheDocument();
    expect(screen.getByText("no período selecionado")).toBeInTheDocument();
    expect(screen.queryByText(/meta/)).not.toBeInTheDocument();
    // A API ignora o filtro sem faixas cadastradas (contrato da STC-588): a
    // tela não troca a busca só para tirá-lo, nem conta como filtro ativo.
    expect(buscasDoPeriodo()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Limpar filtros/ })).not.toBeInTheDocument();
  });

  it("filtros vão para a API no formato do contrato", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.click(screen.getByLabelText("Faixa"));
    await user.click(await screen.findByRole("option", { name: "Só atenção" }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["atencao"]));

    await user.click(screen.getByLabelText("Ocorrência"));
    await user.click(await screen.findByRole("option", { name: "Atraso" }));
    await waitFor(() => expect(ultimaBusca()?.ocorrencia).toEqual(["atraso"]));

    await user.click(screen.getByRole("checkbox", { name: "Com justificativa pendente" }));
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));

    await user.click(screen.getByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await waitFor(() => expect(ultimaBusca()?.unidade).toBe(1));

    await user.click(screen.getByLabelText("Categoria"));
    await user.click(await screen.findByRole("option", { name: "TMO" }));
    await waitFor(() => expect(ultimaBusca()?.categoria).toBe("tmo"));
  });

  it("card de faixa aplica só aquela faixa, mantém a unidade e limpa os filtros de linha", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.click(screen.getByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText("Ocorrência"));
    await user.click(await screen.findByRole("option", { name: "Atraso" }));
    await user.click(screen.getByRole("checkbox", { name: "Com justificativa pendente" }));
    await user.type(screen.getByLabelText("Buscar colaborador"), "juliana");
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));

    const critica = screen.getByRole("button", { name: /^Faixa crítica/ });
    expect(critica).toHaveAttribute("aria-pressed", "false");
    await user.click(critica);

    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["critica"]));
    expect(ultimaBusca()).toMatchObject({ unidade: 1, ocorrencia: undefined, com_pendencias: undefined });
    expect(screen.getByLabelText("Faixa")).toHaveTextContent("Só crítica");
    expect(screen.getByLabelText("Buscar colaborador")).toHaveValue("");
    expect(critica).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Faixa de atenção/ })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /^Faixa de atenção/ }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["atencao"]));

    // Clicar no card já selecionado volta para o filtro padrão.
    await user.click(screen.getByRole("button", { name: /^Faixa de atenção/ }));
    await waitFor(() => expect(ultimaBusca()?.faixa).toEqual(["critica", "atencao"]));
    expect(screen.getByRole("button", { name: /^Faixa de atenção/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("card de justificativas pendentes no VR com os colaboradores de valor provisório", async () => {
    renderPainel();
    await screen.findByText("Juliana Ramos");

    expect(screen.getByText("Justificativas pendentes no VR")).toBeInTheDocument();
    expect(screen.getByText(/colaboradores? com valor provisório$/)).toBeInTheDocument();
  });

  it("filtro de jornada incompleta (turno variável) vai para a API", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.click(screen.getByLabelText("Ocorrência"));
    await user.click(await screen.findByRole("option", { name: "Jornada incompleta" }));
    await waitFor(() => expect(ultimaBusca()?.ocorrencia).toEqual(["jornada_incompleta"]));
  });

  it("troca de filtro esmaece cards e tabela até a resposta chegar", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");
    let responder: (painel: Painel) => void = () => {};
    vi.mocked(buscarPainelAbsenteismo).mockImplementationOnce(
      () => new Promise((resolve) => (responder = resolve)),
    );

    await user.click(screen.getByRole("checkbox", { name: "Com justificativa pendente" }));

    const moldura = () => screen.getByRole("table").closest("[aria-busy]");
    await waitFor(() => expect(moldura()).toHaveAttribute("aria-busy", "true"));
    responder(PAINEL);
    await waitFor(() => expect(moldura()).toBeNull());
  });

  it("filtro de unidade só para Admin", async () => {
    vi.mocked(useAuth).mockReturnValue({ isAdminOps: false } as ReturnType<typeof useAuth>);
    renderPainel();
    await screen.findByText("Juliana Ramos");

    expect(screen.queryByLabelText("Unidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Categoria")).not.toBeInTheDocument();
  });

  it("colaborador sem unidade (TMO) mostra a equipe do VR na coluna Unidade", async () => {
    const [primeira, ...resto] = PAINEL.linhas;
    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue({
      ...PAINEL,
      linhas: [
        {
          ...primeira,
          colaborador: { ...primeira.colaborador, unidade: null, matricula_vr: "" },
          equipe: "TMO - PETROBRAS",
          categoria: "tmo",
        },
        ...resto,
      ],
    });
    renderPainel();

    const linha = (await screen.findByRole("button", { name: primeira.colaborador.nome })).closest("tr")!;
    expect(within(linha).getByText("TMO - PETROBRAS")).toBeInTheDocument();
    // Sem matrícula (relatórios do VR), a linha de baixo começa pelo cargo.
    expect(within(linha).getByText(primeira.colaborador.cargo)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Unidade \/ equipe/ })).toBeInTheDocument();
    // Legenda neutra: os cards não dizem quantos estão sem unidade.
    expect(screen.getByText(`${PAINEL.cards.unidades} unidades`)).toBeInTheDocument();
    // O texto ao passar o mouse é o mesmo da célula, unidade ou equipe.
    expect(within(linha).getByText("TMO - PETROBRAS").closest("td")).toHaveAttribute("title", "TMO - PETROBRAS");
    const deUnidade = screen.getByRole("button", { name: resto[0].colaborador.nome }).closest("tr")!;
    const unidade = resto[0].colaborador.unidade!.nome;
    expect(within(deUnidade).getByText(unidade).closest("td")).toHaveAttribute("title", unidade);
  });

  it("\"Limpar filtros\" também tira a categoria", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.click(screen.getByLabelText("Categoria"));
    await user.click(await screen.findByRole("option", { name: "Campanhas" }));
    await waitFor(() => expect(ultimaBusca()?.categoria).toBe("campanha"));

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(ultimaBusca()?.categoria).toBeUndefined());
    expect(screen.getByLabelText("Categoria")).toHaveTextContent("Todas as categorias");
  });

  it("faixa \"dados desatualizados\" aparece com a importação parada e some sem ela", async () => {
    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue({
      ...PAINEL,
      cards: { ...PAINEL.cards, importacao_parada: true, ultima_importacao: "2026-10-01T20:07:31-03:00" },
    });
    const { unmount } = renderPainel();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Dados desatualizados: a última importação do VR Pontomais foi em 01/10/2026.",
    );
    unmount();

    vi.mocked(buscarPainelAbsenteismo).mockResolvedValue(PAINEL);
    renderPainel();
    await screen.findByText("Juliana Ramos");
    expect(screen.queryByText(/Dados desatualizados/)).not.toBeInTheDocument();
  });

  it("período com o fim antes do início não busca e avisa", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");
    const chamadas = vi.mocked(buscarPainelAbsenteismo).mock.calls.length;

    await user.clear(screen.getByLabelText("até"));
    await user.type(screen.getByLabelText("até"), "2026-08-15");

    expect(screen.getByText("Informe início e fim, com o fim depois do início.")).toBeInTheDocument();
    expect(vi.mocked(buscarPainelAbsenteismo).mock.calls.length).toBe(chamadas);
    expect(screen.getByText("Juliana Ramos")).toBeInTheDocument();
  });

  it("busca por nome sem acento e ordenação pelo cabeçalho", async () => {
    const user = usuario();
    renderPainel();
    await screen.findByText("Juliana Ramos");

    await user.type(screen.getByLabelText("Buscar colaborador"), "leonardo araujo");
    expect(screen.getByText("1 colaborador")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Buscar colaborador"));

    await user.click(screen.getByRole("button", { name: "Banco h." }));
    const primeira = screen.getAllByRole("row")[1];
    expect(within(primeira).getByText("Juliana Ramos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Banco h." }));
    expect(within(screen.getAllByRole("row")[1]).getByText("Rafael Souza")).toBeInTheDocument();
  });

  it("mantém a coluna Colaborador fixa (sticky left-0) ao rolar a tabela para o lado", async () => {
    renderPainel();

    const celula = (await screen.findByRole("button", { name: "Juliana Ramos" })).closest("td");
    expect(celula).toHaveClass("sticky", "left-0");
    expect(screen.getByRole("columnheader", { name: /Colaborador/ })).toHaveClass("sticky", "left-0");
  });

  it("clicar no colaborador abre o modal pela URL", async () => {
    const user = usuario();
    renderPainel();

    await user.click(await screen.findByRole("button", { name: "Juliana Ramos" }));

    expect(replace).toHaveBeenCalledWith("/modulos/gestao-rh?colaborador=8", { scroll: false });
  });

  it("modal abre na aba Absenteísmo: pela linha no período do painel, pelo Kanban no do alerta", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("colaborador=8") as never);
    const { unmount } = renderPainel();
    expect(screen.getByTestId("modal")).toHaveTextContent("8|absenteismo|2026-09-01..2026-09-30|sem-foco");
    unmount();

    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("colaborador=8&inicio=2026-08-01&fim=2026-08-31") as never,
    );
    renderPainel();
    expect(screen.getByTestId("modal")).toHaveTextContent("8|absenteismo|2026-08-01..2026-08-31|foco");
  });

  it("erro sem dados ocupa a tela e oferece tentar de novo", async () => {
    vi.mocked(buscarPainelAbsenteismo).mockRejectedValue(new Error("Falha de rede"));
    renderPainel();

    expect(
      await screen.findByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("comparativo com o período anterior", () => {
  function painelDe(inicio: string, fim: string, percentual: string | null, faixas = { critica: 3, atencao: 2 }): Painel {
    const base = painelAbsenteismoDeExemplo({ inicio, fim });
    return {
      ...base,
      cards: {
        ...base.cards,
        percentual_periodo: percentual,
        faixa_critica: faixas.critica,
        faixa_atencao: faixas.atencao,
      },
    };
  }

  function responderPorPeriodo(percentuais: Record<string, string | null>) {
    vi.mocked(buscarPainelAbsenteismo).mockImplementation(async (filtros) =>
      painelDe(filtros.inicio, filtros.fim, percentuais[filtros.inicio] ?? null),
    );
  }

  it("busca o mês anterior com a unidade e a categoria, sem os filtros de linha", async () => {
    const user = usuario();
    responderPorPeriodo({ "2026-09-01": "4.00", "2026-08-01": "3.60" });
    renderPainel();
    await screen.findByText(/vs\. agosto/);

    expect(buscasDoPeriodo("2026-08-01")[0]).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
      unidade: undefined,
      categoria: undefined,
      faixa: ["critica", "atencao"],
    });

    await user.click(screen.getByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await waitFor(() => expect(buscasDoPeriodo("2026-08-01").at(-1)?.unidade).toBe(1));
    const anteriores = buscasDoPeriodo("2026-08-01").length;
    await user.click(screen.getByRole("checkbox", { name: "Com justificativa pendente" }));
    await waitFor(() => expect(ultimaBusca()?.com_pendencias).toBe(true));
    expect(buscasDoPeriodo("2026-08-01")).toHaveLength(anteriores);
  });

  it("subida: card com a diferença em vermelho, junto da meta", async () => {
    responderPorPeriodo({ "2026-09-01": "4.00", "2026-08-01": "3.60" });
    renderPainel();

    expect(await screen.findByText("▲ +0,4 p.p. vs. agosto")).toHaveClass("text-red-600");
    expect(screen.getByText(/· limite: 5%/)).toBeInTheDocument();
  });

  it("queda: diferença em verde", async () => {
    responderPorPeriodo({ "2026-09-01": "3.20", "2026-08-01": "4.85" });
    renderPainel();

    expect(await screen.findByText("▼ −1,7 p.p. vs. agosto")).toHaveClass("text-emerald-700");
  });

  it("período anterior sem dados ou com falha: legenda como antes", async () => {
    responderPorPeriodo({ "2026-09-01": "4.00" });
    const { unmount } = renderPainel();
    await screen.findByText("Juliana Ramos");
    await waitFor(() => expect(buscasDoPeriodo("2026-08-01")).toHaveLength(1));
    expect(screen.getByText("limite: 5%")).toBeInTheDocument();
    expect(screen.queryByText(/vs\./)).not.toBeInTheDocument();
    unmount();

    vi.mocked(buscarPainelAbsenteismo).mockImplementation(async (filtros) => {
      if (filtros.inicio === "2026-08-01") throw new Error("Falha de rede");
      return painelDe(filtros.inicio, filtros.fim, "4.00");
    });
    renderPainel();
    await screen.findByText("Juliana Ramos");
    await waitFor(() => expect(buscasDoPeriodo("2026-08-01").length).toBeGreaterThan(1));
    expect(screen.getByText("limite: 5%")).toBeInTheDocument();
  });

  it("mês em andamento: compara com o mês inteiro anterior e marca parcial", async () => {
    responderPorPeriodo({ "2026-10-01": "4.00", "2026-09-01": "3.60" });
    renderPainel();
    await screen.findByText("Juliana Ramos");

    fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "2026-10-01" } });

    await screen.findByText("▲ +0,4 p.p. vs. setembro");
    expect(screen.getByText(/\(parcial\)/)).toBeInTheDocument();
  });
});

describe("absenteísmo mês a mês", () => {
  /** Resposta da rota agregada (STC-748): `percentuais` por mês; mês depois de hoje é futuro. */
  function mensalDe(
    ano: number,
    percentuais: Record<number, string | null>,
    { faixas = true, dadosAte = "2026-10-05" }: { faixas?: boolean; dadosAte?: string | null } = {},
  ): AbsenteismoMensal {
    const hoje = new Date();
    const meses = Array.from({ length: 12 }, (_, indice) => {
      const mes = indice + 1;
      const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
      const futuro = new Date(ano, indice, 1) > hoje;
      const percentual = futuro ? null : (percentuais[mes] ?? null);
      return {
        mes,
        inicio: `${prefixo}-01`,
        fim: `${prefixo}-${String(ultimo).padStart(2, "0")}`,
        futuro,
        meta_percentual: "5.00",
        faixas_cadastradas: faixas,
        percentual_periodo: percentual,
        faixa_critica: futuro ? null : percentual === null ? 0 : 3,
        faixa_atencao: futuro ? null : percentual === null ? 0 : 2,
        colaboradores_provisorios: futuro ? null : 0,
      };
    });
    return { ano, dados_ate: dadosAte, meses };
  }

  async function abrirModal(user: ReturnType<typeof usuario>) {
    await screen.findByText("Juliana Ramos");
    await user.click(screen.getByRole("button", { name: /^Absenteísmo.*limite/ }));
    return within(await screen.findByRole("dialog", { name: "Absenteísmo mês a mês" }));
  }

  function linhaDoMes(modal: ReturnType<typeof within>, mes: string) {
    return within(modal.getByRole("rowheader", { name: new RegExp(`^${mes}`) }).closest("tr") as HTMLElement);
  }

  it("uma busca à rota agregada, com o ano, a unidade e a categoria do Painel", async () => {
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockResolvedValue(mensalDe(2026, { 9: "4.00", 10: "4.50" }));
    renderPainel();
    await user.click(await screen.findByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    const buscasAoPainel = vi.mocked(buscarPainelAbsenteismo).mock.calls.length;
    const modal = await abrirModal(user);
    await modal.findByRole("table");

    expect(modal.getByText("Niterói")).toBeInTheDocument();
    expect(buscarAbsenteismoMensal).toHaveBeenCalledTimes(1);
    expect(buscarAbsenteismoMensal).toHaveBeenCalledWith({ ano: 2026, unidade: 1, categoria: undefined });
    // O mês a mês não busca mais o Painel mês a mês.
    expect(vi.mocked(buscarPainelAbsenteismo).mock.calls.length).toBe(buscasAoPainel);
  });

  it("reabrir mostra o que já tinha e atualiza em segundo plano", async () => {
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockResolvedValueOnce(mensalDe(2026, { 9: "4.00" }));
    renderPainel();
    const modal = await abrirModal(user);
    await modal.findByRole("table");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Mudança feita em outra tela (ex.: turno variável ligado): setembro caiu.
    let responder: (mensal: AbsenteismoMensal) => void = () => {};
    vi.mocked(buscarAbsenteismoMensal).mockImplementationOnce(
      () => new Promise((resolve) => (responder = resolve)),
    );
    const reaberto = await abrirModal(user);
    // Na hora, o que já tinha; uma busca nova por abertura.
    expect(reaberto.getByText("4%")).toBeInTheDocument();
    expect(buscarAbsenteismoMensal).toHaveBeenCalledTimes(2);

    responder(mensalDe(2026, { 9: "2.60" }));
    expect(await reaberto.findByText("2,6%")).toBeInTheDocument();
  });

  it("tabela com os meses com dado, a variação para o mês anterior e os meses sem dado", async () => {
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockResolvedValue(mensalDe(2026, { 9: "4.00", 10: "3.50" }));
    renderPainel();
    const modal = await abrirModal(user);
    await modal.findByRole("table");

    expect(modal.getAllByRole("rowheader")).toHaveLength(2);
    const setembro = linhaDoMes(modal, "set");
    expect(setembro.getByText("4%")).toBeInTheDocument();
    // Agosto sem dado: setembro fica sem variação (célula vazia).
    expect(setembro.queryByText(/p\.p\./)).not.toBeInTheDocument();
    const outubro = linhaDoMes(modal, "out");
    expect(outubro.getByText("▼ −0,5 p.p.")).toHaveClass("text-emerald-700");
    // Mês em andamento: até onde vão os dados, no lugar de um selo.
    expect(outubro.getByText(/até 05\/10/)).toBeInTheDocument();
    expect(setembro.queryByText(/até/)).not.toBeInTheDocument();
    expect(outubro.getByText("3")).toBeInTheDocument();
    expect(outubro.getByText("2")).toBeInTheDocument();
    expect(modal.getByText("Sem dados: jan a ago.")).toBeInTheDocument();
  });

  it("sem faixas cadastradas na versão do mês, crítica e atenção dizem isso", async () => {
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockResolvedValue(
      mensalDe(2026, { 9: "4.00" }, { faixas: false }),
    );
    renderPainel();
    const modal = await abrirModal(user);
    await modal.findByRole("table");

    expect(linhaDoMes(modal, "set").getByText("sem faixas")).toBeInTheDocument();
  });

  it("ano sem dados avisa; o seletor troca o ano com uma busca", async () => {
    vi.setSystemTime(new Date(2027, 1, 10, 9, 0));
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockImplementation(async ({ ano }) =>
      ano === 2026 ? mensalDe(2026, { 9: "4.00" }) : mensalDe(2027, {}),
    );
    renderPainel();
    const modal = await abrirModal(user);

    // Painel em janeiro de 2027: abre no ano do período.
    expect(await modal.findByText("Sem dados de absenteísmo em 2027.")).toBeInTheDocument();
    await user.click(modal.getByLabelText("Ano"));
    await user.click(await screen.findByRole("option", { name: "2026" }));
    await modal.findByRole("table");
    expect(linhaDoMes(modal, "set").getByText("4%")).toBeInTheDocument();
    expect(vi.mocked(buscarAbsenteismoMensal).mock.calls.map(([filtros]) => filtros.ano)).toEqual([2027, 2026]);
  });

  it("falha na busca: avisa e tenta de novo", async () => {
    const user = usuario();
    vi.mocked(buscarAbsenteismoMensal).mockRejectedValueOnce(new Error("Falha de rede"));
    renderPainel();
    const modal = await abrirModal(user);

    expect(await modal.findByText("Não foi possível carregar o absenteísmo de 2026.")).toBeInTheDocument();
    vi.mocked(buscarAbsenteismoMensal).mockResolvedValue(mensalDe(2026, { 9: "4.00" }));
    await user.click(modal.getByRole("button", { name: "Tentar novamente" }));
    expect(await modal.findByRole("table")).toBeInTheDocument();
  });
});
