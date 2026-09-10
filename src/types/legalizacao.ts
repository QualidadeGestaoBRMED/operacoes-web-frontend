import type { Unidade, Usuario } from "./index";

// Espelha TipoDocumentoRegulatorio.Categoria (backend/legalizacao/models.py).
export type CategoriaDocumento =
  | "regularizacao"
  | "registros_tecnicos"
  | "capacitacao"
  | "infraestrutura"
  | "equipamentos"
  | "programas"
  | "residuos";

// Espelha TipoDocumentoRegulatorio.AreaResponsavel -- não confundir com o
// AreaResponsavel de Gestão de Demandas (types/index.ts), valores distintos
// e sem relação entre os dois módulos.
export type AreaResponsavelDocumento = "legalizacao" | "coordenacao";

export interface TipoDocumentoRegulatorio {
  id: number;
  codigo: string;
  nome: string;
  categoria: CategoriaDocumento;
  area_responsavel: AreaResponsavelDocumento;
  setor_apoio: string;
  exige_validade: boolean;
  exige_protocolo: boolean;
  exige_evidencia: boolean;
  ativo: boolean;
  created_at: string;
}

// Espelha RegraDocumento.Criticidade -- reaproveitada também por
// AlertaRegulatorio.criticidade (mesmo choices no backend).
export type Criticidade = "baixa" | "media" | "alta";

// Shape de leitura (aninhado em DocumentoUnidade.regra_aplicada, via
// RegraDocumentoSerializer): tipo_documento/unidade vêm como ID cru, não
// aninhados -- diferente de DocumentoUnidade, que já traz os dois objetos
// completos um nível acima.
export interface RegraDocumento {
  id: number;
  tipo_documento: number;
  unidade: number;
  antecedencia_dias: number;
  periodicidade_meses: number | null;
  janela_dia_inicio: number | null;
  janela_dia_fim: number | null;
  criticidade: Criticidade;
  vigente_a_partir: string;
  ativa: boolean;
  gera_card_demanda: boolean;
  created_at: string;
}

export interface ResponsavelDocumento {
  id: number;
  usuario: Usuario;
  principal: boolean;
  created_at: string;
}

export type StatusDocumento =
  | "regular"
  | "nao_aplicavel"
  | "nao_iniciado"
  | "em_andamento"
  | "protocolado"
  | "vencido"
  | "unidade_encerramento";

// Shape de GET (list/retrieve) -- DocumentoUnidadeReadSerializer.
// evidencia_vigente vem como ID cru (FK não aninhada no serializer real);
// criticidade não é campo direto aqui -- só existe via regra_aplicada?.criticidade.
export interface DocumentoUnidade {
  id: number;
  tipo_documento: TipoDocumentoRegulatorio;
  unidade: Unidade;
  status: StatusDocumento;
  justificativa_excecao: string;
  validade: string | null;
  evidencia_vigente: number | null;
  regra_aplicada: RegraDocumento | null;
  responsaveis: ResponsavelDocumento[];
  created_at: string;
  updated_at: string;
}

// Espelha HistoricoRegulatorioSerializer -- usuario vem null quando a ação
// foi automática do sistema (ex.: transição pra Vencido na varredura
// diária) ou quando a conta de quem agiu foi removida depois (SET_NULL);
// não dá pra distinguir os dois casos só pelos dados, então o frontend
// trata ambos como "Sistema" (ver DetalheDocumentoModal.tsx).
export interface HistoricoRegulatorio {
  id: number;
  usuario: Usuario | null;
  acao: string;
  valor_anterior: string;
  valor_novo: string;
  created_at: string;
}

export interface EvidenciaRegulatoria {
  id: number;
  usuario: Usuario;
  arquivo: string;
  nome_original: string;
  tamanho_bytes: number;
  vigente: boolean;
  emitido_em: string | null;
  validade_comprovada: string | null;
  processo_renovacao: number | null;
  created_at: string;
}

// 100% leitura (AlertaRegulatorioSerializer, STC-398 paginado) -- nasce só
// pela varredura diária ou pela movimentação profissional (imediato=true).
// criticidade pode vir "" (blank=True no model -- formato de escalonamento
// ainda não definido, ver Plano de Ação - Legalização.md §5/§9).
export interface AlertaRegulatorio {
  id: number;
  documento_unidade: DocumentoUnidade;
  ciclo_referencia: string;
  antecedencia_usada_dias: number;
  criticidade: Criticidade | "";
  imediato: boolean;
  status_tratamento: string;
  data_geracao: string;
}

// Payload de criação de TipoDocumentoRegulatorioViewSet.create() -- omite
// id/created_at (read_only_fields no serializer real).
export interface TipoDocumentoRegulatorioPayload {
  codigo: string;
  nome: string;
  categoria: CategoriaDocumento;
  area_responsavel: AreaResponsavelDocumento;
  setor_apoio?: string;
  exige_validade: boolean;
  exige_protocolo: boolean;
  exige_evidencia: boolean;
  ativo?: boolean;
}

// Payload de criação de RegraDocumentoViewSet.create() -- omite id/created_at.
export interface RegraDocumentoPayload {
  tipo_documento: number;
  unidade: number;
  antecedencia_dias: number;
  periodicidade_meses?: number | null;
  janela_dia_inicio?: number | null;
  janela_dia_fim?: number | null;
  criticidade: Criticidade;
  vigente_a_partir: string;
  ativa?: boolean;
  gera_card_demanda?: boolean;
}

// Payload de criação/edição de DocumentoUnidadeViewSet
// (DocumentoUnidadeWriteSerializer) -- tipo_documento/unidade e regra_aplicada
// vêm como ID cru (PrimaryKeyRelatedField), diferente do shape de leitura.
export interface DocumentoUnidadePayload {
  tipo_documento: number;
  unidade: number;
  status: StatusDocumento;
  justificativa_excecao?: string;
  validade?: string | null;
  regra_aplicada?: number | null;
}

export type StatusProcessoRenovacao =
  "nao_iniciado" | "em_andamento" | "protocolado" | "concluido";

// Espelha ProcessoRenovacaoReadSerializer -- documento_unidade/usuario_
// responsavel vêm aninhados (não IDs crus, diferente de RegraDocumento).
export interface ProcessoRenovacao {
  id: number;
  documento_unidade: DocumentoUnidade;
  status: StatusProcessoRenovacao;
  data_solicitacao: string | null;
  protocolo_numero: string;
  protocolo_orgao: string;
  protocolo_data: string | null;
  observacoes: string;
  data_conclusao: string | null;
  usuario_responsavel: Usuario | null;
  created_at: string;
}

// Payload de POST /processos-renovacao/ -- nasce direto em `em_andamento`
// (o POST em si já é o "iniciar", RF-009); nenhum outro campo é aceito na
// criação.
export interface ProcessoRenovacaoPayload {
  documento_unidade: number;
  usuario_responsavel?: number | null;
}

// Payload de PATCH /processos-renovacao/{id}/ (STC-381) -- "Salvar
// protocolo" manda status=protocolado + os 4 campos de protocolo;
// "Concluir renovação" manda status=concluido + nova_validade (write-only
// no serializer, aplicado em DocumentoUnidade.validade pela view, nunca
// volta na leitura). documento_unidade/usuario_responsavel nunca são
// reenviados por aqui -- travado/preservado no backend.
export interface ProcessoRenovacaoAtualizacaoPayload {
  status?: StatusProcessoRenovacao;
  protocolo_numero?: string;
  protocolo_orgao?: string;
  protocolo_data?: string | null;
  observacoes?: string;
  nova_validade?: string;
}

export type TipoMovimentacaoProfissional = "saida" | "entrada";

// Payload de POST /documentos/{id}/movimentacao-profissional/ (STC-382) --
// MovimentacaoProfissionalSerializer (backend), os 3 campos são os únicos
// aceitos e todos obrigatórios. `profissional`/`funcao` (esta última só
// client-side, nunca enviada) existem só pra registrar/guiar a UI -- o
// backend não persiste nome de profissional em lugar nenhum além do
// histórico (valor_novo formatado com o nome, ver registrar_historico).
export interface MovimentacaoProfissionalPayload {
  tipo: TipoMovimentacaoProfissional;
  profissional: string;
  data: string;
}

// Espelha DocumentoUnidadeFilterSet (backend/legalizacao/views.py) --
// "search"/"ordering" não existem aqui (DocumentoUnidadeViewSet não declara
// esses filter_backends, diferente de DemandaViewSet). "categoria" também
// não entra aqui de propósito -- não existe no FilterSet real, é aplicado
// só no client (mesmo tratamento de "busca" no MatrizConformidade.tsx, não
// faz parte do objeto que vai pro backend).
export interface DocumentoUnidadeFiltros {
  unidade?: number;
  tipo_documento?: number;
  status?: StatusDocumento;
  responsavel?: number;
  criticidade?: Criticidade;
  prazo_ate?: string;
}
