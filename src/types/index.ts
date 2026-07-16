export interface Perfil {
  id: number;
  nome: string;
  descricao: string;
  nivel: number;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  perfil: Perfil | null;
  unidade_id: number | null;
  setor_id: number | null;
  ativo: boolean;
  ultimo_acesso: string | null;
}

export interface Unidade {
  id: number;
  nome: string;
  codigo: string;
  cidade: string;
  ativa: boolean;
}

export interface Setor {
  id: number;
  nome: string;
  codigo: string;
  modulo_id: number | null;
  ativo: boolean;
}

export type VisibilidadePadrao = "admin" | "unidade" | "setor" | "todos";

export interface TipoGestao {
  id: number;
  modulo: number;
  nome: string;
  codigo: string;
  descricao: string;
  visibilidade_padrao: VisibilidadePadrao;
  ativo: boolean;
  ordem: number;
}

export interface Categoria {
  id: number;
  modulo: number;
  nome: string;
  ativa: boolean;
}

export interface Etiqueta {
  id: number;
  modulo: number;
  nome: string;
  cor: string;
}

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

export type StatusDemanda = "backlog" | "em_andamento" | "em_revisao" | "concluido" | "lixeira";

export interface DemandaResponsavel {
  id: number;
  usuario: Usuario;
  tipo: "principal" | "colaborador";
}

// Shape de GET (list/retrieve) -- relacionamentos vêm aninhados
// (DemandaReadSerializer). Escrita usa DemandaPayload, mais fino.
export interface Demanda {
  id: number;
  titulo: string;
  descricao: string;
  tipo_gestao: TipoGestao;
  prioridade: Prioridade;
  status: StatusDemanda;
  unidade: Unidade;
  setor: Setor | null;
  categoria: Categoria | null;
  solicitante: Usuario;
  aprovador: Usuario | null;
  responsaveis: DemandaResponsavel[];
  etiquetas: Etiqueta[];
  data_prevista: string;
  data_conclusao: string | null;
  confidencial: boolean;
  created_at: string;
  updated_at: string;
}

// Campos aceitos por DemandaWriteSerializer -- status/solicitante/aprovador
// ficam de fora de propósito (status só muda via atualizarStatusDemanda;
// solicitante vem do usuário autenticado no backend).
export interface DemandaPayload {
  titulo: string;
  descricao: string;
  tipo_gestao: number;
  prioridade: Prioridade;
  unidade: number;
  setor?: number | null;
  categoria?: number | null;
  data_prevista: string;
  confidencial?: boolean;
}

export interface DemandaStatusPayload {
  status: StatusDemanda;
  aprovador_id?: number;
  justificativa?: string;
}

// Espelha filterset_fields + search + ordering de DemandaViewSet.
export interface DemandaFiltros {
  tipo_gestao?: number;
  unidade?: number;
  setor?: number;
  status?: StatusDemanda;
  prioridade?: Prioridade;
  categoria?: number;
  search?: string;
  ordering?: string;
}

// GET /modulos/gestao-demandas/resumo/ (ResumoView) -- mesmo contrato
// planejado pra Hub (hoje bloqueada), reaproveitado aqui pros cards de KPI
// do Kanban.
export interface EstatisticaResumo {
  valor: string;
  rotulo: string;
  atencao: boolean;
}

export interface OcorrenciaResumo {
  severidade: "critico" | "atencao";
  titulo: string;
  subtitulo: string;
  responsavel: string | null;
  tempo_atras: string;
}

export interface ResumoDemandas {
  estatisticas: EstatisticaResumo[];
  ocorrencias: OcorrenciaResumo[];
}
