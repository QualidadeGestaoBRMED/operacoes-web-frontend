import type { CSSProperties, ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LinhaHorasExtras, PainelHorasExtras } from "@/types/gestaoRH";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { montagensDeBar } from "@/test-utils/rechartsDeTeste";
import { GraficosHorasExtras } from "./GraficosHorasExtras";

vi.mock("recharts", () => import("@/test-utils/rechartsDeTeste"));
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
    <div data-testid="area-do-grafico" style={style}>
      {children}
    </div>
  ),
}));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn(() => false) }));

function linha(id: number, nome: string, minutos: number, minutos100 = 0, cargo = ""): LinhaHorasExtras {
  return {
    colaborador: { id, nome, matricula_vr: "", cargo, unidade: { id: 2, nome: "Macaé" } },
    equipe: "Operações Macaé",
    minutos_por_fator: [
      { fator: "1", minutos },
      { fator: "2", minutos: minutos100 },
    ],
    total_minutos: minutos + minutos100,
    dias_com_hora_extra: 1,
  };
}

const PAINEL = {
  fatores: [
    { fator: "1", percentual: "50" },
    { fator: "2", percentual: "100" },
  ],
  // Juliana tem mais horas no total; Bruno, mais a 50%. Ana não tem 50%.
  linhas: [linha(8, "Juliana Ramos", 30, 240), linha(9, "Bruno Lima", 60), linha(10, "Ana Souza", 0, 45)],
  por_unidade: [
    {
      unidade_id: 2,
      nome: "Macaé",
      minutos_por_fator: [
        { fator: "1", minutos: 180 },
        { fator: "2", minutos: 0 },
      ],
      total_minutos: 180,
    },
    {
      unidade_id: 1,
      nome: "Niterói",
      minutos_por_fator: [
        { fator: "1", minutos: 60 },
        { fator: "2", minutos: 0 },
      ],
      total_minutos: 60,
    },
  ],
} as PainelHorasExtras;

/** O gráfico pelo começo do título ("Top 3 colaboradores…"). */
function grafico(doQue: RegExp) {
  return within(screen.getByRole("heading", { name: doQue }).closest("section")!);
}

function barras(fator: "fator_1" | "fator_2", alvo: Pick<typeof screen, "queryAllByRole"> = screen) {
  return alvo
    .queryAllByRole("button", { hidden: true })
    .map((botao) => botao.textContent ?? "")
    .filter((texto) => texto.startsWith(`${fator}:`))
    .map((texto) => texto.slice(fator.length + 1));
}

describe("GraficosHorasExtras", () => {
  it("barra do colaborador, nos dois fatores, seleciona; no já selecionado, limpa", async () => {
    const selecionar = vi.fn();
    const { rerender } = render(
      <GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={selecionar} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "fator_1:Bruno Lima", hidden: true }));
    expect(selecionar).toHaveBeenLastCalledWith(PAINEL.linhas[1]);
    await userEvent.click(screen.getByRole("button", { name: "fator_2:Juliana Ramos", hidden: true }));
    expect(selecionar).toHaveBeenLastCalledWith(PAINEL.linhas[0]);

    rerender(<GraficosHorasExtras painel={PAINEL} selecionado={PAINEL.linhas[0]} onSelecionar={selecionar} />);
    await userEvent.click(screen.getByRole("button", { name: "fator_1:Juliana Ramos", hidden: true }));
    expect(selecionar).toHaveBeenLastCalledWith(null);
  });

  it("barra da unidade não seleciona nada", async () => {
    const selecionar = vi.fn();
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={selecionar} />);

    await userEvent.click(screen.getByRole("button", { name: "fator_1:Macaé", hidden: true }));
    expect(selecionar).not.toHaveBeenCalled();
  });

  it("com um colaborador selecionado: a barra dele em destaque e, ao lado, só a unidade dele", () => {
    // Bruno é de Macaé: ao lado, só a unidade dele.
    render(<GraficosHorasExtras painel={PAINEL} selecionado={PAINEL.linhas[1]} onSelecionar={vi.fn()} />);

    const opacidade = (nome: string) =>
      screen.getByRole("button", { name: `fator_1:${nome}`, hidden: true }).dataset.opacidade;
    expect(opacidade("Bruno Lima")).toBe("1");
    expect(opacidade("Juliana Ramos")).toBe("0.3");
    const unidades = grafico(/Unidade do colaborador/);
    expect(unidades.getByRole("heading")).toHaveTextContent("Unidade do colaborador em horas extras");
    expect(barras("fator_1", unidades)).toEqual(["Macaé"]);
  });

  it("com uma unidade só, o gráfico ao lado mostra só o cargo do selecionado", () => {
    const painel = {
      ...PAINEL,
      por_unidade: PAINEL.por_unidade.slice(0, 1),
      linhas: [linha(1, "A", 120, 0, "MOTORISTA"), linha(2, "B", 200, 0, "TECNICO DE ENFERMAGEM I")],
    } as PainelHorasExtras;
    render(<GraficosHorasExtras painel={painel} selecionado={painel.linhas[0]} onSelecionar={vi.fn()} />);

    const cargos = grafico(/Cargo do colaborador/);
    expect(barras("fator_1", cargos)).toEqual(["MOTORISTA"]);
  });

  it("sem fator escolhido: os dois fatores empilhados, ordem pelo total", () => {
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);

    const colaboradores = grafico(/colaboradores/);
    expect(colaboradores.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
    expect(barras("fator_1", colaboradores)).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);
    expect(barras("fator_2", colaboradores)).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);
    expect(colaboradores.getByRole("button", { name: "50%" })).toHaveAttribute("aria-pressed", "false");
  });

  it("escolher um fator mostra só ele, com o ranking por ele; clicar de novo volta aos dois", async () => {
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);
    const colaboradores = () => grafico(/colaboradores/);

    await userEvent.click(colaboradores().getByRole("button", { name: "50%" }));
    expect(colaboradores().getByRole("button", { name: "50%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Top 2 colaboradores em horas extras 50%" })).toBeInTheDocument();
    // Ranking pelos minutos a 50%, sem quem não tem 50%.
    expect(barras("fator_1", colaboradores())).toEqual(["Bruno Lima", "Juliana Ramos"]);
    expect(barras("fator_2", colaboradores())).toEqual([]);

    await userEvent.click(colaboradores().getByRole("button", { name: "100%" }));
    expect(screen.getByRole("heading", { name: "Top 2 colaboradores em horas extras 100%" })).toBeInTheDocument();
    expect(barras("fator_2", colaboradores())).toEqual(["Juliana Ramos", "Ana Souza"]);
    expect(barras("fator_1", colaboradores())).toEqual([]);

    await userEvent.click(colaboradores().getByRole("button", { name: "100%" }));
    expect(screen.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
  });

  it("STC-764: escolher um fator e tirar mantém a pilha (50% e depois 100%) e a ponta na barra certa", async () => {
    for (const chave of Object.keys(montagensDeBar)) delete montagensDeBar[chave];
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);
    const colaboradores = () => grafico(/colaboradores/);
    const ponta = (fator: string) =>
      colaboradores()
        .getAllByRole("button", { name: new RegExp(`^${fator}:`), hidden: true })
        .map((botao) => botao.dataset.ponta);
    // Um <Bar> por fator em cada um dos dois gráficos.
    expect(montagensDeBar).toEqual({ fator_1: 2, fator_2: 2 });
    expect(ponta("fator_2")).toEqual(["sim", "sim", "sim"]);

    await userEvent.click(colaboradores().getByRole("button", { name: "100%" }));
    expect(ponta("fator_2")).toEqual(["sim", "sim"]);
    await userEvent.click(colaboradores().getByRole("button", { name: "50%" }));
    expect(ponta("fator_1")).toEqual(["sim", "sim"]);
    await userEvent.click(colaboradores().getByRole("button", { name: "50%" }));

    // Nenhum <Bar> montou de novo: a ordem do empilhamento é a do primeiro render.
    expect(montagensDeBar).toEqual({ fator_1: 2, fator_2: 2 });
    expect(ponta("fator_1")).toEqual(["nao", "nao", "nao"]);
    expect(ponta("fator_2")).toEqual(["sim", "sim", "sim"]);
  });

  it("cada gráfico escolhe o fator sozinho", async () => {
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);

    await userEvent.click(screen.getAllByRole("button", { name: "100%" })[1]);
    expect(screen.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
    // A unidade não tem 100%: o gráfico avisa em vez de ficar vazio.
    expect(screen.getByText("Nenhuma hora extra 100% no período.")).toBeInTheDocument();
  });

  it("uma unidade só (filtrada, ou a da coordenação): por cargo, com a soma de cada cargo", async () => {
    const painel = {
      ...PAINEL,
      por_unidade: PAINEL.por_unidade.slice(0, 1),
      linhas: [
        linha(1, "A", 120, 0, "MOTORISTA"),
        linha(2, "B", 60, 60, "MOTORISTA"),
        linha(3, "C", 200, 0, "TECNICO DE ENFERMAGEM I"),
        linha(4, "D", 0, 30, " "),
      ],
    } as PainelHorasExtras;
    render(<GraficosHorasExtras painel={painel} selecionado={null} onSelecionar={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Top 3 cargos em horas extras" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /unidades/ })).not.toBeInTheDocument();
    // MOTORISTA soma 240 min (dois colaboradores), à frente dos 200 do técnico.
    expect(barras("fator_1", grafico(/cargos/))).toEqual(["MOTORISTA", "TECNICO DE ENFERMAGEM I", "Sem cargo"]);

    await userEvent.click(grafico(/cargos/).getByRole("button", { name: "100%" }));
    expect(screen.getByRole("heading", { name: "Top 2 cargos em horas extras 100%" })).toBeInTheDocument();
    expect(barras("fator_2", grafico(/cargos/))).toEqual(["MOTORISTA", "Sem cargo"]);
  });

  it("lado a lado, os dois com a altura do que tem mais barras; empilhados, cada um com a sua", () => {
    // Colaboradores: 3 barras; unidades: 2.
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const { unmount } = render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);
    const ladoALado = screen.getAllByTestId("area-do-grafico").map((area) => area.style.height);
    expect(ladoALado).toEqual(["134px", "134px"]);
    unmount();

    vi.mocked(useMediaQuery).mockReturnValue(false);
    render(<GraficosHorasExtras painel={PAINEL} selecionado={null} onSelecionar={vi.fn()} />);
    expect(screen.getAllByTestId("area-do-grafico").map((area) => area.style.height)).toEqual([
      "134px",
      "100px",
    ]);
  });
});
