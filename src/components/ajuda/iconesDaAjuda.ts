import {
  ChartColumn,
  LayoutGrid,
  Smartphone,
  SquarePlus,
  TriangleAlert,
  UserMinus,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones que um artigo da Ajuda pode escolher no cabeçalho (`icone`), como
 * no Linear Docs, onde cada card tem o seu. Sem `icone`, vale o do módulo.
 * Lista curta de propósito: um nome fora dela é recusado pelo teste do
 * conteúdo.
 */
export const ICONES_DA_AJUDA: Record<string, LucideIcon> = {
  alerta: TriangleAlert,
  celular: Smartphone,
  desligado: UserMinus,
  grade: LayoutGrid,
  grafico: ChartColumn,
  "nova-demanda": SquarePlus,
};
