import type { Demanda, DemandaFiltros, Prioridade, StatusDemanda } from "@/types";

export const COLUNAS: { status: StatusDemanda; titulo: string }[] = [
  { status: "backlog", titulo: "Backlog" },
  { status: "em_andamento", titulo: "Em Andamento" },
  { status: "em_revisao", titulo: "Em Revisão" },
  { status: "concluido", titulo: "Concluído" },
  { status: "lixeira", titulo: "Lixeira" },
];

export const ORDEM_COLUNAS = COLUNAS.map((coluna) => coluna.status);

const PESO_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

// Antes vinha só na ordem que o backend devolve (-created_at, "mais
// recente primeiro") -- ninguém tinha escolhido isso de propósito pro
// board. Prazo mais próximo primeiro (o que precisa de atenção logo)
// desempatado por prioridade é mais operacional que ordem de criação.
export function compararDemandas(a: Demanda, b: Demanda): number {
  const prazoDiff = new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
  if (prazoDiff !== 0) return prazoDiff;
  return PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
}

// Transições que o backend sempre rejeita hoje porque exigem um dado que
// o drag-and-drop do board não coleta (aprovador_id/justificativa -- isso
// é a mini-formulário da rota "completa" discutida, ainda não construída).
// Bloquear aqui ANTES do optimistic update evita o floop visual de mover o
// card, a coluna se reorganizar, e tudo voltar de novo alguns instantes
// depois quando o rollback chega.
const TRANSICOES_SEM_DADO_COLETADO = new Set([
  "em_andamento->em_revisao",
  "em_andamento->backlog",
  "em_revisao->em_andamento",
  "em_revisao->backlog",
  "concluido->em_andamento",
  "concluido->backlog",
]);

export function mensagemBloqueioConhecido(
  demanda: Demanda,
  novoStatus: StatusDemanda,
): string | null {
  if (TRANSICOES_SEM_DADO_COLETADO.has(`${demanda.status}->${novoStatus}`)) {
    return novoStatus === "em_revisao"
      ? "Selecione um aprovador para enviar à revisão."
      : "Justificativa obrigatória para essa transição.";
  }

  if (demanda.status === "backlog" && novoStatus === "em_andamento") {
    const temPrincipal = demanda.responsaveis.some((r) => r.tipo === "principal");
    if (!temPrincipal) return "Defina um responsável principal antes de iniciar a execução.";
  }

  return null;
}

// Mesmo critério do backend (ResumoView) pras métricas "atrasadas"/"sem
// responsável" -- clicar no card de KPI usa isso como atalho de filtro
// rápido no board, sem precisar de um filtro dedicado (nem de refazer a
// consulta: os dados já estão carregados no client).
export function passaNoFoco(demanda: Demanda, foco: string | null): boolean {
  if (!foco) return true;
  if (demanda.status === "concluido") return false;

  if (foco === "atrasadas") {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(`${demanda.data_prevista}T00:00:00`) < hoje;
  }
  if (foco === "sem responsável") {
    return !demanda.responsaveis.some((r) => r.tipo === "principal");
  }
  return true;
}

export function filtrosDaUrl(searchParams: URLSearchParams): DemandaFiltros {
  const filtros: DemandaFiltros = {};
  const unidade = searchParams.get("unidade");
  const prioridade = searchParams.get("prioridade");
  const categoria = searchParams.get("categoria");
  const search = searchParams.get("search");
  if (unidade) filtros.unidade = Number(unidade);
  if (prioridade) filtros.prioridade = prioridade as Prioridade;
  if (categoria) filtros.categoria = Number(categoria);
  if (search) filtros.search = search;
  return filtros;
}
