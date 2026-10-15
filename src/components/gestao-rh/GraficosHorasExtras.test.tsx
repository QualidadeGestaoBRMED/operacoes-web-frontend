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

function linha(id: number, nome: string, minutos: number): LinhaHorasExtras {
  return {
    colaborador: { id, nome, matricula_vr: "", cargo: "", unidade: null },
    equipe: "TMO Rio",
    categoria: "tmo",
    minutos_por_fator: [
      { fator: "1", minutos },
      { fator: "2", minutos: 0 },
    ],
    total_minutos: minutos,
    dias_com_hora_extra: 1,
  };
}

const PAINEL = {
  fatores: [
    { fator: "1", percentual: "50" },
    { fator: "2", percentual: "100" },
  ],
  linhas: [linha(8, "Juliana Ramos", 120), linha(9, "Bruno Lima", 60)],
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

  it("legenda com os percentuais da rota", () => {
    render(<GraficosHorasExtras painel={PAINEL} comUnidadeFiltrada onAbrirColaborador={vi.fn()} />);

    expect(screen.getAllByText("50%")).toHaveLength(1);
    expect(screen.getAllByText("100%")).toHaveLength(1);
    expect(screen.queryByText("Horas extras por unidade / equipe")).not.toBeInTheDocument();
  });
});
