import type {
  AreaResponsavel,
  Demanda,
  DemandaFiltros,
  Prioridade,
  StatusDemanda,
  TipoGestao,
} from "@/types";

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

// Identificador estável de TipoGestao pro tipo de gestão "Operacional" --
// espelha CODIGO_TIPO_GESTAO_OPERACIONAL de backend/demandas/serializers.py.
// Nunca comparar pelo "nome" (rótulo pt-BR livre, editável sem constraint).
export const CODIGO_TIPO_GESTAO_OPERACIONAL = "operacional";

/**
 * Tipo de gestão ativo no quadro (STC-884): o da aba (`tipo_gestao` da URL).
 * Quem enxerga um tipo só não tem abas e fica sem `tipo_gestao` na URL; o
 * ativo é esse tipo, para o filtro pedir as unidades da rede dele e mostrar
 * Unidade ou Área conforme o tipo.
 */
export function tipoGestaoAtivo(
  tiposGestao: TipoGestao[],
  tipoGestaoDaUrl: number | undefined,
): TipoGestao | undefined {
  const daUrl = tiposGestao.find((tipo) => tipo.id === tipoGestaoDaUrl);
  return daUrl ?? (tiposGestao.length === 1 ? tiposGestao[0] : undefined);
}

export const LABEL_AREA_RESPONSAVEL: Record<AreaResponsavel, string> = {
  gerencia: "Gerência",
  processo: "Processo",
  qualidade: "Qualidade",
  desenvolvimento: "Desenvolvimento",
};

// Demandas do tipo de gestão "Operacional" usam area_responsavel em vez de
// unidade (ver AreaResponsavel em types/index.ts) -- os dois campos nunca
// vêm preenchidos ao mesmo tempo. Usado quando "Unidade"/"Área Responsável"
// precisa virar um texto só (aria-label do card; o próprio nome da unidade
// quando não há área) -- DemandaCard/DetalheCard renderizam as áreas como
// badges/Pills separados na parte visível, sem passar por aqui, então não
// há necessidade (nem lugar apropriado) de condensar/truncar o texto:
// aria-label não tem limite de largura como um badge visual tem.
export function rotuloUnidadeOuResponsavel(demanda: Demanda): string {
  if (demanda.area_responsavel.length > 0) {
    return demanda.area_responsavel.map((area) => LABEL_AREA_RESPONSAVEL[area]).join(", ");
  }
  return demanda.unidade?.nome ?? "";
}

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

/**
 * Coloca uma demanda na posição dela numa coluna já ordenada pelo backend
 * (STC-930), para a mudança aparecer na hora, antes de a coluna ser buscada
 * de novo. Concluído é da conclusão mais recente para a mais antiga, então
 * a recém-concluída vai para o topo; nas outras, a ordem de prazo e
 * prioridade (compararDemandas, desempate pelo id como no backend).
 */
export function inserirNaColuna(
  demandas: Demanda[],
  demanda: Demanda,
  status: StatusDemanda,
  temMais = false,
): Demanda[] {
  const semEla = demandas.filter((item) => item.id !== demanda.id);
  if (status === "concluido") return [demanda, ...semEla];
  const posicao = semEla.findIndex(
    (item) => (compararDemandas(demanda, item) || demanda.id - item.id) < 0,
  );
  if (posicao === -1) {
    // Depois do último card carregado de uma coluna que tem mais páginas: o
    // lugar dele é numa página ainda não carregada. Mostrar no fim e ele sumir
    // na próxima atualização confundiria; ele aparece quando a coluna rolar até lá.
    return temMais ? semEla : [...semEla, demanda];
  }
  return [...semEla.slice(0, posicao), demanda, ...semEla.slice(posicao)];
}

/**
 * Se ainda vale buscar mais páginas de uma fase com o foco dos cartões do
 * topo ligado (STC-931). O foco nunca mostra cards de algumas fases
 * (concluídas não contam como atrasadas nem sem responsável; "em andamento"
 * só vale para a própria fase), e buscar as páginas delas só para escondê-las
 * baixaria o histórico inteiro. Em "atrasadas", a coluna vem do backend pelo
 * prazo: depois do primeiro card no prazo não há mais atrasado.
 */
export function focoPrecisaDeMais(
  foco: string | null,
  status: StatusDemanda,
  carregadas: Demanda[],
): boolean {
  if (!foco || status === "lixeira") return true;
  if (status === "concluido") return false;
  if (foco === "em andamento") return status === "em_andamento";
  if (foco === "atrasadas") {
    const ultima = carregadas[carregadas.length - 1];
    return !ultima || ultima.data_prevista < hojeNoFusoDoServidor();
  }
  return true;
}

// Espelha TRANSICOES_PERMITIDAS de backend/demandas/views.py -- "lixeira"
// fica de fora de propósito (é soft delete via DELETE, não essa rota).
export const TRANSICOES_PERMITIDAS: Record<StatusDemanda, StatusDemanda[]> = {
  backlog: ["em_andamento"],
  em_andamento: ["backlog", "em_revisao", "concluido"],
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

type SecaoDeBloqueio = "status" | "responsavel";

// Espelha exatamente o par TRANSICOES_ADMIN_ONLY/TRANSICOES_SO_APROVADOR_OU_ADMIN
// checado em views.py -- única fonte da regra "esse usuário pode fazer essa
// transição?", usada tanto pra filtrar as opções do Select (statusPermitidosParaUsuario)
// quanto pelo bloqueio do drag-and-drop (achado no review: KanbanBoard usava
// mensagemBloqueioConhecido/secaoDoBloqueio sem considerar permissão do
// usuário -- um usuário sem permissão em em_revisao->em_andamento recebia
// toast pra "usar Mudar status", mas TransicaoStatusSection nem mostra essa
// opção pra ele, já que filtra pelo mesmo critério).
function usuarioTemPermissaoParaTransicao(
  demanda: Demanda,
  novoStatus: StatusDemanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): boolean {
  const par = `${demanda.status}->${novoStatus}`;
  if (TRANSICOES_ADMIN_ONLY.has(par)) return isAdminOps;
  if (TRANSICOES_SO_APROVADOR_OU_ADMIN.has(par)) {
    // usuarioId !== undefined explícito: sem isso, os dois undefined
    // (sessão ainda carregando E demanda sem aprovador) bateriam entre
    // si e liberariam a opção indevidamente.
    return isAdminOps || (usuarioId !== undefined && demanda.aprovador?.id === usuarioId);
  }
  return true;
}

// Mesmo padrão de AnexoList.tsx: esconde a opção que o usuário atual não tem
// como executar (em vez de mostrar tudo e deixar o backend rejeitar com 403).
export function statusPermitidosParaUsuario(
  demanda: Demanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): StatusDemanda[] {
  return proximosStatusValidos(demanda.status).filter((statusAlvo) =>
    usuarioTemPermissaoParaTransicao(demanda, statusAlvo, isAdminOps, usuarioId),
  );
}

// Compartilhado entre mensagemBloqueioConhecido (toast) e secaoDoBloqueio
// (STC-203: qual seção do DetalheCard abrir pra resolver o bloqueio) -- as
// duas precisam concordar sobre qual transição está bloqueada e por quê,
// então derivam da mesma árvore de condições em vez de cada uma reimplementá-la.
function bloqueioDetalhado(
  demanda: Demanda,
  novoStatus: StatusDemanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): { mensagem: string; secao: SecaoDeBloqueio | null } | null {
  // Achado em autorevisão: usuarioTemPermissaoParaTransicao só checa QUEM
  // pode fazer a transição, não SE ela existe -- um par fora de
  // TRANSICOES_PERMITIDAS (ex.: backlog->concluido) não está em nenhum dos
  // sets de permissão, então passava direto por essa função sem bloqueio
  // nenhum. O Select de "Mudar status" nunca oferece esses pares (filtra
  // por proximosStatusValidos em statusPermitidosParaUsuario), mas o
  // drag-and-drop do KanbanBoard chama bloqueioDetalhado direto, sem esse
  // filtro -- sem essa checagem, um drag pra uma coluna não-adjacente só
  // falhava depois, na resposta 400 do backend. "lixeira" fica de fora de
  // propósito (mesmo motivo do TRANSICOES_PERMITIDAS de backend/demandas/views.py):
  // mover pra lá é soft-delete (moverDemanda chama excluirDemanda, não
  // atualizarStatusDemanda), nunca uma transição de status de verdade.
  if (novoStatus !== "lixeira" && !proximosStatusValidos(demanda.status).includes(novoStatus)) {
    return {
      mensagem: `Não é possível mover de "${ROTULO_STATUS[demanda.status]}" para "${ROTULO_STATUS[novoStatus]}".`,
      secao: null,
    };
  }

  if (!usuarioTemPermissaoParaTransicao(demanda, novoStatus, isAdminOps, usuarioId)) {
    // secao: null de propósito -- TransicaoStatusSection filtra essa mesma
    // transição fora de opcoesStatus pra esse usuário, então "abra e use
    // Mudar status" seria uma ação impossível (achado no review).
    return {
      mensagem: "Você não tem permissão para fazer essa transição.",
      secao: null,
    };
  }

  if (precisaAprovador(demanda.status, novoStatus)) {
    return {
      mensagem: 'Selecione um aprovador para enviar à revisão -- abra a demanda e use "Mudar status".',
      secao: "status",
    };
  }
  if (precisaJustificativa(demanda.status, novoStatus)) {
    return {
      mensagem: 'Justificativa obrigatória para essa transição -- abra a demanda e use "Mudar status".',
      secao: "status",
    };
  }

  if (demanda.status === "backlog" && novoStatus === "em_andamento") {
    const temPrincipal = demanda.responsaveis.some((r) => r.tipo === "principal");
    if (!temPrincipal) {
      return {
        mensagem: "Defina um responsável principal antes de iniciar a execução.",
        secao: "responsavel",
      };
    }
  }

  return null;
}

export function mensagemBloqueioConhecido(
  demanda: Demanda,
  novoStatus: StatusDemanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): string | null {
  return bloqueioDetalhado(demanda, novoStatus, isAdminOps, usuarioId)?.mensagem ?? null;
}

// STC-203: qual seção do DetalheCard abrir automaticamente quando o
// drag-and-drop é bloqueado -- em vez de só mostrar o toast e deixar o
// usuário refazer tudo manualmente.
export function secaoDoBloqueio(
  demanda: Demanda,
  novoStatus: StatusDemanda,
  isAdminOps: boolean,
  usuarioId: number | undefined,
): SecaoDeBloqueio | null {
  return bloqueioDetalhado(demanda, novoStatus, isAdminOps, usuarioId)?.secao ?? null;
}

// Achado em autorevisão: usar new Date() aqui calcula "hoje" no fuso do
// navegador do cliente -- o backend (ResumoView) usa timezone.now().date()
// no fuso do servidor (TIME_ZONE=America/Sao_Paulo, core/settings/base.py).
// Os dois podem divergir perto da virada da meia-noite ou se o cliente
// estiver noutro fuso, fazendo esse atalho de filtro mostrar um conjunto
// diferente do que o KPI "atrasadas" (calculado no backend) prometeu.
// Intl.DateTimeFormat com timeZone explícito calcula "hoje" nesse fuso sem
// depender do fuso local do navegador -- "en-CA" formata como YYYY-MM-DD,
// mesmo formato de Demanda.data_prevista (DateField), então dá pra comparar
// como string ISO direto, sem nem precisar parsear pra Date.
// Exportado -- KanbanBoard.tsx reaproveita pro mesmo motivo (achado lá:
// update otimista do drag-and-drop pra "concluido" não setava
// data_conclusao com a data certa).
export function hojeNoFusoDoServidor(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Achado em autorevisão: DemandaCard (badge "atrasada") e DetalheCard (campo
// "Prazo") calculavam "faltam quantos dias" com new Date() local -- mesma
// classe de bug de hojeNoFusoDoServidor, só que com uma conta de dias em vez
// de uma comparação booleana, então não dava pra só reaproveitar a string
// "hoje" acima. "T00:00:00Z" força as duas datas a meia-noite UTC -- sem
// isso, o parser de Date trataria "YYYY-MM-DD" e "YYYY-MM-DDT00:00:00" de
// jeitos diferentes (o primeiro como UTC, o segundo como fuso local),
// reintroduzindo a mesma dependência do fuso do navegador que isso existe
// pra eliminar.
export function diasAteOPrazo(dataPrevista: string): number {
  const hoje = new Date(`${hojeNoFusoDoServidor()}T00:00:00Z`);
  const prazo = new Date(`${dataPrevista}T00:00:00Z`);
  return Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
}

// Mesmo critério do backend (ResumoView) pras métricas "atrasadas"/"sem
// responsável" -- clicar no card de KPI usa isso como atalho de filtro
// rápido no board, sem precisar de um filtro dedicado (nem de refazer a
// consulta: os dados já estão carregados no client).
export function passaNoFoco(demanda: Demanda, foco: string | null): boolean {
  if (!foco) return true;
  if (demanda.status === "concluido") return false;

  if (foco === "atrasadas") {
    return demanda.data_prevista < hojeNoFusoDoServidor();
  }
  if (foco === "sem responsável") {
    return !demanda.responsaveis.some((r) => r.tipo === "principal");
  }
  if (foco === "em andamento") {
    return demanda.status === "em_andamento";
  }
  return true;
}

export function filtrosDaUrl(searchParams: URLSearchParams): DemandaFiltros {
  const filtros: DemandaFiltros = {};
  const tipoGestao = searchParams.get("tipo_gestao");
  const unidade = searchParams.get("unidade");
  const areaResponsavel = searchParams.get("area_responsavel");
  const setor = searchParams.get("setor");
  const responsavel = searchParams.get("responsavel");
  const prioridade = searchParams.get("prioridade");
  const categoria = searchParams.get("categoria");
  const search = searchParams.get("search");
  if (tipoGestao) filtros.tipo_gestao = Number(tipoGestao);
  if (unidade) filtros.unidade = Number(unidade);
  // Mesmo contrato de AreaResponsavelFilter (backend/demandas/views.py):
  // uma lista separada por vírgula num único param, não vários params
  // repetidos.
  if (areaResponsavel) filtros.area_responsavel = areaResponsavel.split(",") as AreaResponsavel[];
  if (setor) filtros.setor = Number(setor);
  if (responsavel) filtros.responsavel = Number(responsavel);
  if (prioridade) filtros.prioridade = prioridade as Prioridade;
  if (categoria) filtros.categoria = Number(categoria);
  if (search) filtros.search = search;
  return filtros;
}
