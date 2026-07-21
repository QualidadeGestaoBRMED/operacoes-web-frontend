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

// GET/POST /demandas/{id}/comentarios/ (STC-159/STC-168) -- texto é o único
// campo de escrita, demanda/usuario vêm do contexto da requisição no backend.
export interface Comentario {
  id: number;
  usuario: Usuario;
  texto: string;
  created_at: string;
}

// GET/POST /demandas/{id}/anexos/ (STC-160/STC-168). "arquivo" é a URL do
// arquivo -- relativa em dev local (FileSystemStorage), absoluta em produção
// (R2/S3Boto3Storage já devolve URL completa). Ver lib/demandas.ts.
export interface Anexo {
  id: number;
  usuario: Usuario;
  arquivo: string;
  nome_original: string;
  tamanho: number;
  created_at: string;
}

// Valores reais de HistoricoAlteracao.campo_alterado (backend/demandas/
// historico.py: CAMPOS_EDICAO_AUDITADOS + "criacao"/"status"/"responsavel"
// registrados à parte pelos outros 3 gatilhos de auditoria).
export type CampoHistorico =
  | "criacao"
  | "titulo"
  | "descricao"
  | "tipo_gestao"
  | "prioridade"
  | "unidade"
  | "setor"
  | "categoria"
  | "data_prevista"
  | "confidencial"
  | "status"
  | "responsavel";

// GET /demandas/{id}/historico/ (STC-159/STC-168) -- só leitura, nunca
// escrito pelo cliente.
export interface HistoricoAlteracao {
  id: number;
  usuario: Usuario;
  campo_alterado: CampoHistorico;
  valor_anterior: string;
  valor_novo: string;
  justificativa: string;
  created_at: string;
}
