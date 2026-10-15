// Recharts para os testes de componente: o jsdom não mede layout e o
// Recharts de verdade não desenha as barras. Cada <Bar> vira um botão por
// item ("fator_1:Nome"), com o mesmo onClick que o Recharts chamaria e a
// opacidade do <Cell> do item em `data-opacidade` (destaque da barra).
// Uso: vi.mock("recharts", () => import("@/test-utils/rechartsDeTeste")).

import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";

const Dados = createContext<{ nome: string }[]>([]);

export function BarChart({ data, children }: { data: { nome: string }[]; children: ReactNode }) {
  return <Dados.Provider value={data}>{children}</Dados.Provider>;
}

export function Bar({
  dataKey,
  onClick,
  children,
}: {
  dataKey: string;
  onClick?: (dado: { payload: { nome: string } }) => void;
  children?: ReactNode;
}) {
  const dados = useContext(Dados);
  const celulas = Children.toArray(children).filter(isValidElement) as { props: { fillOpacity?: number } }[];
  return dados.map((item, indice) => (
    <button
      key={item.nome}
      type="button"
      data-opacidade={celulas[indice]?.props.fillOpacity ?? 1}
      onClick={() => onClick?.({ payload: item })}
    >
      {dataKey}:{item.nome}
    </button>
  ));
}

// As props do <Cell> são lidas pelo <Bar> acima; ele mesmo não desenha nada.
export const Cell = (() => null) as (props: { fillOpacity?: number }) => null;

export const CartesianGrid = () => null;
export const Tooltip = () => null;
export const Legend = () => null;
export const XAxis = () => null;
export const YAxis = () => null;

// Usado pelo ChartContainer (components/ui/chart.tsx).
export function ResponsiveContainer({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
