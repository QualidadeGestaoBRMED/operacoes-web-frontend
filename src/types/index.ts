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

// Payload de PATCH em /plataforma/usuarios/<id>/ -- só os campos que a tela
// de administração (STC-266) edita (perfil/unidade/setor "base" da pessoa).
// UsuarioSerializer aceita mais campos (first_name, ativo etc.), mas essa
// tela não mexe neles.
export interface UsuarioPayload {
  perfil_id?: number | null;
  unidade_id?: number | null;
  setor_id?: number | null;
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

export interface Modulo {
  id: number;
  nome: string;
  codigo: string;
  descricao: string;
  status: string;
  versao: string;
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

// Só se aplica a demandas cujo tipo_gestao.codigo é "operacional" -- ver
// CODIGO_TIPO_GESTAO_OPERACIONAL em lib/kanban.ts. Demandas desse tipo não
// têm unidade (não representam uma clínica); qualquer outro tipo tem
// unidade e nunca area_responsavel. Os dois campos são mutuamente
// exclusivos, nunca preenchidos ao mesmo tempo.
export type AreaResponsavel = "gerencia" | "processo" | "qualidade" | "desenvolvimento";

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
  unidade: Unidade | null;
  area_responsavel: AreaResponsavel | null;
  setor: Setor | null;
  categoria: Categoria | null;
  solicitante: Usuario;
  aprovador: Usuario | null;
  responsaveis: DemandaResponsavel[];
  etiquetas: Etiqueta[];
  data_prevista: string;
  data_conclusao: string | null;
  confidencial: boolean;
  comentarios_count: number;
  anexos_count: number;
  // Capacidade calculada pelo backend para o usuário autenticado. Inclui
  // papel normal e PermissaoUsuario temporária vigente; o client não
  // replica regras de escopo/período.
  pode_editar: boolean;
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
  unidade?: number | null;
  area_responsavel?: AreaResponsavel | null;
  setor?: number | null;
  categoria?: number | null;
  etiquetas?: number[];
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
  area_responsavel?: AreaResponsavel;
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
// usuario é nulável de propósito no model (on_delete=SET_NULL) -- o
// comentário sobrevive à exclusão da conta do autor, então o campo pode vir
// null aqui. Ver nomeOuRemovido() em lib/utils.ts.
export interface Comentario {
  id: number;
  usuario: Usuario | null;
  texto: string;
  created_at: string;
}

// GET/POST /demandas/{id}/anexos/ (STC-160/STC-168). "arquivo" é a URL do
// arquivo -- relativa em dev local (FileSystemStorage), absoluta em produção
// (R2/S3Boto3Storage já devolve URL completa). Ver lib/demandas.ts. usuario
// nulável pelo mesmo motivo de Comentario (SET_NULL na exclusão da conta).
export interface Anexo {
  id: number;
  usuario: Usuario | null;
  arquivo: string;
  nome_original: string;
  tamanho: number;
  created_at: string;
}

// Valores reais de HistoricoAlteracao.campo_alterado (backend/demandas/
// historico.py: CAMPOS_EDICAO_AUDITADOS + "criacao"/"status"/"responsavel"/
// "anexo" registrados à parte pelos outros gatilhos de auditoria).
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
  | "anexo"
  | "status"
  | "responsavel";

// GET /demandas/{id}/historico/ (STC-159/STC-168) -- só leitura, nunca
// escrito pelo cliente. usuario nulável pelo mesmo motivo de Comentario/
// Anexo (SET_NULL na exclusão da conta).
export interface HistoricoAlteracao {
  id: number;
  usuario: Usuario | null;
  campo_alterado: CampoHistorico;
  valor_anterior: string;
  valor_novo: string;
  justificativa: string;
  created_at: string;
}

// Valores reais de tipo em demandas/notificacoes.py (STC-161) -- string
// livre no model (igual CampoHistorico), não TextChoices.
export type TipoNotificacao =
  | "demanda_criada"
  | "responsavel_atribuido"
  | "comentario_novo"
  | "status_alterado"
  | "aprovador_designado";

// GET /plataforma/notificacoes/ (STC-161/STC-169). "link" é uma string
// genérica pro frontend navegar (ex.: "/modulos/gestao-demandas?demanda=5"),
// não uma FK -- Notificacao é model de plataforma, não depende de nenhum
// módulo específico. Pode vir "" quando o tipo de notificação não leva a
// lugar nenhum.
export interface Notificacao {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;
  link: string;
  lida: boolean;
  created_at: string;
}

// NotificacaoViewSet é o único recurso de plataforma paginado (crescimento
// não-limitado por usuário ao longo do tempo) -- formato padrão do
// PageNumberPagination do DRF.
export interface RespostaPaginada<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// GET/POST /plataforma/permissoes-usuario/ (PermissaoUsuarioViewSet,
// STC-266) -- acesso individual temporário, escopado por unidade/setor/
// próprio, com período de validade. Restrito a Admin Operações/Admin Q&G
// no backend (IsAdminOperacoes). PermissaoUsuarioSerializer é um
// ModelSerializer simples (sem nested), então usuario/unidade/setor/
// concedido_por vêm como IDs crus -- a UI resolve nome cruzando com
// useUsuarios/useUnidades/useSetores, já carregados em outros lugares do
// app.
export type EscopoPermissao = "global" | "unidade" | "setor" | "proprio";

export type AcaoPermissao =
  | "visualizar"
  | "criar"
  | "editar"
  | "aprovar"
  | "excluir"
  | "restaurar"
  | "configurar";

export interface PermissaoUsuario {
  id: number;
  usuario: number;
  modulo: number | null;
  recurso: string;
  acao: AcaoPermissao;
  escopo_tipo: EscopoPermissao;
  unidade: number | null;
  setor: number | null;
  concedido_por: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
}

// concedido_por é setado pelo backend a partir do usuário autenticado
// (perform_create) -- nunca enviado pelo cliente.
export interface PermissaoUsuarioPayload {
  usuario: number;
  modulo?: number | null;
  recurso: string;
  acao: AcaoPermissao;
  escopo_tipo: EscopoPermissao;
  unidade?: number | null;
  setor?: number | null;
  data_inicio: string;
  data_fim?: string | null;
}
