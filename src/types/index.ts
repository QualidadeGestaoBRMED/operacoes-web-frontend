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
  // STC-862: unidades além da principal, com o mesmo acesso. Só vem no
  // usuário da Administração, do login e de /auth/me/ (aninhado em outros
  // lugares, não vem); ausente equivale a nenhuma.
  unidades_adicionais_ids?: number[];
  setor_id: number | null;
  // Opcional (não required): campo novo (STC-520), muitos fixtures de teste
  // pelo código constroem Usuario sem ele -- ausência equivale a null pra
  // quem consome (ex. useAuth.isSetorLeg checa session?.user?.setor?.codigo).
  setor?: Setor | null;
  // STC-745: redes que o usuário administra pelo cargo. Opcional: sessão
  // aberta antes do campo existir não o traz (ver lib/redes.ts).
  redes_administradas?: Rede[];
  ativo: boolean;
  ultimo_acesso: string | null;
  foto_url: string;
}

// Payload de PATCH em /plataforma/usuarios/<id>/ -- só os campos que a tela
// de administração (STC-266) edita (perfil/unidade/setor "base" da pessoa).
// UsuarioSerializer aceita mais campos (first_name, ativo etc.), mas essa
// tela não mexe neles.
export interface UsuarioPayload {
  perfil_id?: number | null;
  unidade_id?: number | null;
  unidades_adicionais_ids?: number[];
  setor_id?: number | null;
}

// STC-509 (backend): rede normal (filiais/clínicas) vs. Operações
// Especiais (aeroclínicas etc.) -- mesma Unidade estrutural, só uma
// dimensão a mais pra decidir qual é elegível pra qual cargo/tela.
export type Rede = "padrao" | "opex";

export interface Unidade {
  id: number;
  nome: string;
  codigo: string;
  cidade: string;
  ativa: boolean;
  rede: Rede;
}

export interface Setor {
  id: number;
  nome: string;
  codigo: string;
  modulo_id: number | null;
  ativo: boolean;
}

// STC-421 (backend): catálogo de recursos de PermissaoUsuario, fonte única
// de quais ações cada recurso suporta -- ver RecursoPermissao no backend.
// Nasce aninhado em Modulo (nested read-only), não tem endpoint próprio.
export interface RecursoPermissao {
  id: number;
  chave: string;
  rotulo: string;
  acoes_suportadas: AcaoPermissao[];
}

export interface Modulo {
  id: number;
  nome: string;
  codigo: string;
  descricao: string;
  status: string;
  versao: string;
  recursos_permissao: RecursoPermissao[];
}

export type VisibilidadePadrao = "admin" | "unidade" | "setor" | "todos" | "opex";

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
  area_responsavel: AreaResponsavel[];
  setor: Setor | null;
  categoria: Categoria | null;
  solicitante: Usuario;
  aprovador: Usuario | null;
  responsaveis: DemandaResponsavel[];
  etiquetas: Etiqueta[];
  data_prevista: string;
  data_conclusao: string | null;
  confidencial: boolean;
  // Preenchido só em demanda criada por outro módulo (ex. card espelho da
  // Legalização, STC-448) -- vazio ("") no caso comum. Link de volta pra
  // tela real de onde a demanda foi gerada (STC-450/STC-451).
  origem_url: string;
  // Card controlado por outro módulo que aceita anexos mesmo assim (ex.:
  // card de absenteísmo do Gestão RH, STC-846).
  origem_aceita_anexos: boolean;
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
  area_responsavel?: AreaResponsavel[];
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
  area_responsavel?: AreaResponsavel[];
  setor?: number;
  responsavel?: number;
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

// Formato padrão do PageNumberPagination do DRF -- usado por qualquer
// recurso com crescimento não-limitado ao longo do tempo (NotificacaoViewSet,
// e desde a STC-398 também DemandaViewSet e AlertaRegulatorioViewSet).
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
  // Só no escopo global (STC-745): a rede que ele cobre; null, as duas.
  rede?: Rede | null;
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
  // Só no escopo global; ausente, o backend usa a rede de quem concede.
  rede?: Rede | null;
  data_inicio: string;
  data_fim?: string | null;
}

// STC-746: GET /plataforma/acessos/ (STC-744). Um uso por pessoa por dia.
export interface ReferenciaPorNome {
  id: number;
  nome: string;
}

export interface UsuarioAcesso {
  id: number;
  nome: string;
  email: string;
  perfil: ReferenciaPorNome | null;
  unidade: ReferenciaPorNome | null;
  setor: ReferenciaPorNome | null;
  /** Último dia com uso, de qualquer data guardada; null para quem nunca usou. */
  ultimo_uso: string | null;
  dias_desde_o_ultimo_uso: number | null;
  /** Dias com uso dentro do período consultado. */
  dias_com_uso: number;
  dias: string[];
}

export interface Acessos {
  periodo: { inicio: string; fim: string };
  hoje: string;
  /** Quem nunca usou primeiro, depois quem está há mais tempo sem usar. */
  usuarios: UsuarioAcesso[];
}
