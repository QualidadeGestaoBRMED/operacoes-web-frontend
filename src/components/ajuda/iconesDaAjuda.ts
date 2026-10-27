import {
  ArrowLeftRight,
  BellRing,
  Bot,
  ChartColumn,
  Columns3,
  FilePlus2,
  FileSearch,
  FileUp,
  LayoutGrid,
  Library,
  ListFilter,
  Mail,
  RefreshCw,
  Smartphone,
  SquareKanban,
  SquarePlus,
  TriangleAlert,
  UserMinus,
  UsersRound,
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
  aviso: BellRing,
  biblioteca: Library,
  automatico: Bot,
  celular: Smartphone,
  desligado: UserMinus,
  documento: FileSearch,
  "detalhe-demanda": FileSearch,
  "novo-documento": FileUp,
  "novo-tipo": FilePlus2,
  grade: LayoutGrid,
  grafico: ChartColumn,
  lista: ListFilter,
  quadro: SquareKanban,
  colunas: Columns3,
  "e-mail": Mail,
  movimentacao: ArrowLeftRight,
  "nova-demanda": SquarePlus,
  renovacao: RefreshCw,
  responsaveis: UsersRound,
};
