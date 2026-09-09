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
