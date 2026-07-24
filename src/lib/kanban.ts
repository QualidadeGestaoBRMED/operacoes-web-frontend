import type { Demanda, DemandaFiltros, Prioridade, StatusDemanda } from "@/types";

// Semáforo de severidade -- cores reais de status, não os tokens de marca
// (o próprio ProntuAI faz o mesmo: usa red-600/green-600/yellow-600 do
// Tailwind pros indicadores de severidade/aprovação, reservando os tokens
// de qeg_design.json pro chrome da UI). Compartilhado entre DemandaCard e
// DetalheCard (STC-168) -- antes vivia só dentro de DemandaCard.tsx.
export const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "bg-red-600",
  alta: "bg-orange-600",
  media: "bg-yellow-600",
  baixa: "bg-green-600",
};

export const LABEL_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const COLUNAS: { status: StatusDemanda; titulo: string }[] = [
  { status: "backlog", titulo: "Backlog" },
  { status: "em_andamento", titulo: "Em Andamento" },
  { status: "em_revisao", titulo: "Em Revisão" },
  { status: "concluido", titulo: "Concluído" },
  { status: "lixeira", titulo: "Lixeira" },
];

export const ORDEM_COLUNAS = COLUNAS.map((coluna) => coluna.status);

// Antes duplicado identicamente em DetalheCard.tsx e HistoricoTimeline.tsx.
export const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  COLUNAS.map((coluna) => [coluna.status, coluna.titulo]),
);

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

// Espelha TRANSICOES_PERMITIDAS de backend/demandas/views.py -- "lixeira"
// fica de fora de propósito (é soft delete via DELETE, não essa rota).
export const TRANSICOES_PERMITIDAS: Record<StatusDemanda, StatusDemanda[]> = {
  backlog: ["em_andamento"],
  em_andamento: ["backlog", "em_revisao"],
  em_revisao: ["em_andamento", "backlog", "concluido"],
  concluido: ["em_andamento", "backlog"],
  lixeira: [],
};

export function proximosStatusValidos(statusAtual: StatusDemanda): StatusDemanda[] {
  return TRANSICOES_PERMITIDAS[statusAtual];
}

// Espelha TRANSICOES_ADMIN_ONLY (views.py) -- só Admin Q&G/Admin Operações
// pode executar. Usado pelo TransicaoStatusSection pra decidir quais
// status-alvo mostrar pro usuário atual (mesmo padrão de esconder ação sem
// permissão já usado em AnexoList.tsx, em vez de deixar o backend rejeitar).
export const TRANSICOES_ADMIN_ONLY = new Set([
  "em_revisao->backlog",
  "concluido->em_andamento",
  "concluido->backlog",
]);

// Espelha TRANSICOES_SO_APROVADOR_OU_ADMIN (views.py) -- só o aprovador
// designado da demanda ou um admin pode decidir a revisão.
export const TRANSICOES_SO_APROVADOR_OU_ADMIN = new Set([
  "em_revisao->concluido",
  "em_revisao->em_andamento",
]);

// Espelha TRANSICOES_COM_JUSTIFICATIVA_OBRIGATORIA (views.py) + o único par
// que exige aprovador (em_andamento->em_revisao) -- nunca os dois juntos.
const TRANSICOES_QUE_EXIGEM_JUSTIFICATIVA = new Set([
  "em_andamento->backlog",
  "em_revisao->em_andamento",
  "em_revisao->backlog",
  "concluido->em_andamento",
  "concluido->backlog",
]);

export function precisaAprovador(de: StatusDemanda, para: StatusDemanda): boolean {
  return de === "em_andamento" && para === "em_revisao";
}

export function precisaJustificativa(de: StatusDemanda, para: StatusDemanda): boolean {
  return TRANSICOES_QUE_EXIGEM_JUSTIFICATIVA.has(`${de}->${para}`);
}

export function mensagemBloqueioConhecido(
  demanda: Demanda,
  novoStatus: StatusDemanda,
): string | null {
  if (precisaAprovador(demanda.status, novoStatus)) {
    return 'Selecione um aprovador para enviar à revisão -- abra a demanda e use "Mudar status".';
  }
  if (precisaJustificativa(demanda.status, novoStatus)) {
    return 'Justificativa obrigatória para essa transição -- abra a demanda e use "Mudar status".';
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
  const tipoGestao = searchParams.get("tipo_gestao");
  const unidade = searchParams.get("unidade");
  const setor = searchParams.get("setor");
  const prioridade = searchParams.get("prioridade");
  const categoria = searchParams.get("categoria");
  const search = searchParams.get("search");
  if (tipoGestao) filtros.tipo_gestao = Number(tipoGestao);
  if (unidade) filtros.unidade = Number(unidade);
  if (setor) filtros.setor = Number(setor);
  if (prioridade) filtros.prioridade = prioridade as Prioridade;
  if (categoria) filtros.categoria = Number(categoria);
  if (search) filtros.search = search;
  return filtros;
}
