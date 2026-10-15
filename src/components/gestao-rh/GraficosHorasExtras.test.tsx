import { createContext, useContext, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LinhaHorasExtras, PainelHorasExtras } from "@/types/gestaoRH";
import { GraficosHorasExtras } from "./GraficosHorasExtras";

// O jsdom não mede layout e o Recharts não desenha as barras: cada <Bar>
// vira um botão por item, com o mesmo onClick que o Recharts chamaria
// (escondidos do leitor de tela, como o gráfico).
vi.mock("recharts", () => {
  const Dados = createContext<{ nome: string }[]>([]);
  return {
    BarChart: ({ data, children }: { data: { nome: string }[]; children: ReactNode }) => (
      <Dados.Provider value={data}>{children}</Dados.Provider>
    ),
    Bar: function Bar({
      dataKey,
      onClick,
    }: {
      dataKey: string;
      onClick?: (dado: { payload: { nome: string } }) => void;
    }) {
      const dados = useContext(Dados);
      return dados.map((item) => (
        <button key={item.nome} type="button" onClick={() => onClick?.({ payload: item })}>
          {dataKey}:{item.nome}
        </button>
      ));
    },
    CartesianGrid: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function linha(id: number, nome: string, minutos: number, minutos100 = 0): LinhaHorasExtras {
  return {
    colaborador: { id, nome, matricula_vr: "", cargo: "", unidade: null },
    equipe: "TMO Rio",
    categoria: "tmo",
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
      unidade_id: null,
      nome: "TMO Rio",
      minutos_por_fator: [
        { fator: "1", minutos: 180 },
        { fator: "2", minutos: 0 },
      ],
      total_minutos: 180,
    },
  ],
} as PainelHorasExtras;

function barras(fator: "fator_1" | "fator_2") {
  return screen
    .queryAllByRole("button", { hidden: true })
    .map((botao) => botao.textContent ?? "")
    .filter((texto) => texto.startsWith(`${fator}:`))
    .map((texto) => texto.slice(fator.length + 1));
}

describe("GraficosHorasExtras", () => {
  it("barra do colaborador, nos dois fatores, abre o modal dele", async () => {
    const abrir = vi.fn();
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada={false} onAbrirColaborador={abrir} />);

    await userEvent.click(screen.getByRole("button", { name: "fator_1:Bruno Lima", hidden: true }));
    expect(abrir).toHaveBeenLastCalledWith(PAINEL.linhas[1]);
    await userEvent.click(screen.getByRole("button", { name: "fator_2:Juliana Ramos", hidden: true }));
    expect(abrir).toHaveBeenLastCalledWith(PAINEL.linhas[0]);
  });

  it("barra da unidade não abre nada", async () => {
    const abrir = vi.fn();
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada={false} onAbrirColaborador={abrir} />);

    await userEvent.click(screen.getByRole("button", { name: "fator_1:TMO Rio", hidden: true }));
    expect(abrir).not.toHaveBeenCalled();
  });

  it("sem fator escolhido: os dois fatores empilhados, ordem pelo total", () => {
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada onAbrirColaborador={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
    expect(barras("fator_1")).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);
    expect(barras("fator_2")).toEqual(["Juliana Ramos", "Bruno Lima", "Ana Souza"]);
    expect(screen.getByRole("button", { name: "50%" })).toHaveAttribute("aria-pressed", "false");
  });

  it("escolher um fator mostra só ele, com o ranking por ele; clicar de novo volta aos dois", async () => {
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada onAbrirColaborador={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "50%" }));
    expect(screen.getByRole("button", { name: "50%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Top 2 colaboradores em horas extras 50%" })).toBeInTheDocument();
    // Ranking pelos minutos a 50%, sem quem não tem 50%.
    expect(barras("fator_1")).toEqual(["Bruno Lima", "Juliana Ramos"]);
    expect(barras("fator_2")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "100%" }));
    expect(screen.getByRole("heading", { name: "Top 2 colaboradores em horas extras 100%" })).toBeInTheDocument();
    expect(barras("fator_2")).toEqual(["Juliana Ramos", "Ana Souza"]);
    expect(barras("fator_1")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "100%" }));
    expect(screen.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
  });

  it("cada gráfico escolhe o fator sozinho", async () => {
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada={false} onAbrirColaborador={vi.fn()} />);

    await userEvent.click(screen.getAllByRole("button", { name: "100%" })[1]);
    expect(screen.getByRole("heading", { name: "Top 3 colaboradores em horas extras" })).toBeInTheDocument();
    // A unidade não tem 100%: o gráfico avisa em vez de ficar vazio.
    expect(screen.getByText("Nenhuma hora extra 100% no período.")).toBeInTheDocument();
  });
});
