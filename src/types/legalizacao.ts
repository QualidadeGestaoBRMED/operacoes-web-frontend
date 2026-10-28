import type { Rede, StatusDemanda, Unidade, Usuario } from "./index";

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

/** Em quais redes o tipo é usado (STC-904): cada rede tem o seu catálogo,
 * e um tipo comum às duas é "ambas", sem cópia. */
export type AbrangenciaTipoDocumento = "padrao" | "opex" | "ambas";

export interface TipoDocumentoRegulatorio {
  id: number;
  codigo: string;
  nome: string;
  categoria: CategoriaDocumento;
  area_responsavel: AreaResponsavelDocumento;
  abrangencia: AbrangenciaTipoDocumento;
  setor_apoio: string;
  exige_validade: boolean;
  exige_protocolo: boolean;
  exige_evidencia: boolean;
  // STC-428 (backend): true só pra Dosimetria hoje -- DocumentoUnidade deste
  // tipo aceita múltiplas linhas por unidade, uma por `profissional`. Liga
  // também o fluxo de Movimentação Profissional (RN11) -- não confundir com
  // permite_multiplas_instancias abaixo, que é o mecanismo genérico (sem
  // Movimentação Profissional) usado pra equipamentos.
  controlado_por_profissional: boolean;
  // STC-489 (backend): true habilita o cadastro em lote (documentos/lote/)
  // pra este tipo -- N DocumentoUnidade por unidade, um por identificador
  // livre (reaproveita a mesma coluna `profissional`, sem ligar RN11).
  permite_multiplas_instancias: boolean;
  // STC-536 (backend): sugestão inicial pro campo "Antecedência (dias)" nos
  // 3 forms de cadastro/nova versão de regra -- editável só via Django
  // Admin, sem tela do app pra isso (decisão de negócio). Opcional: além do
  // fallback pra 60 (backend pode não devolver ainda, deploy fora de
  // ordem), evita reescrever cada fixture de teste que já existia antes
  // desta issue e não usa este campo.
  antecedencia_padrao_dias?: number;
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

// STC-518: payload de POST /documentos/{id}/responsaveis/ (endpoint já
// existia no backend, sem cliente no frontend até aqui) -- DELETE usa só
// o usuario_id, sem tipo próprio.
export interface ResponsavelDocumentoPayload {
  usuario_id: number;
  principal?: boolean;
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
  // STC-428 (backend): texto livre, vazio pro caso comum. Obrigatório
  // quando tipo_documento.controlado_por_profissional=True (Dosimetria),
  // proibido nos demais tipos -- é o campo que diferencia múltiplas linhas
  // do mesmo tipo+unidade.
  profissional: string;
  created_at: string;
  updated_at: string;
}

// Resposta do PATCH do documento (STC-833): Regular à mão com a renovação
// aberta conclui a renovação junto; Em andamento ou Protocolado sem renovação
// aberta abre uma no mesmo status. Opcionais: o backend anterior à STC-833
// não manda os campos (o frontend é publicado antes dele).
export interface DocumentoUnidadeAtualizado extends DocumentoUnidade {
  renovacao_concluida_junto?: boolean;
  renovacao_aberta_junto?: boolean;
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
  // STC-833: motivo de uma mudança manual de status; vazio nas demais ações.
  justificativa: string;
  created_at: string;
}

// STC-500 (backend): mesmo shape de HistoricoRegulatorio, tabela dedicada
// pro catálogo (TipoDocumentoRegulatorio não é FK de HistoricoRegulatorio
// -- ver types/legalizacao.ts::TipoDocumentoRegulatorio). "campo" em vez
// de "acao": nome do campo editado (ex. "nome", "categoria").
export interface HistoricoTipoDocumento {
  id: number;
  usuario: Usuario | null;
  campo: string;
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

// STC-416 (Biblioteca de Documentos): visão agregada, uma linha por
// documento com evidência vigente numa unidade -- endpoint dedicado
// (documentos/evidencias-vigentes/?unidade=X), não o DocumentoUnidadeRead
// Serializer normal (evidencia_vigente ali continua FK crua, sem
// arquivo/nome_original). documento_unidade é o ID cru do DocumentoUnidade
// dono desta evidência -- chave pra casar com a lista de
// useDocumentosLegalizacao().
export interface EvidenciaVigente {
  documento_unidade: number;
  arquivo: string;
  nome_original: string;
  tamanho_bytes: number;
  emitido_em: string | null;
  validade_comprovada: string | null;
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
  abrangencia?: AbrangenciaTipoDocumento;
  // STC-526: nome do setor_apoio.setor_apoio_id (write-only no backend) --
  // ver TipoDocumentoRegulatorioSerializer.
  setor_apoio_id?: number | null;
  exige_validade: boolean;
  exige_protocolo: boolean;
  exige_evidencia: boolean;
  controlado_por_profissional?: boolean;
  permite_multiplas_instancias?: boolean;
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
  profissional?: string;
  // STC-497: sinaliza que este PATCH está terminando a configuração de um
  // documento recém-criado em lote (passo 2 de
  // FormCadastrarDocumentosEmLote.tsx) -- backend só pula a máquina de
  // estados de status com este flag explícito, nunca automaticamente.
  definindo_status_inicial?: boolean;
  // STC-833: obrigatória em toda mudança manual de status (exceto Não
  // aplicável/Unidade em encerramento, que usam justificativa_excecao).
  justificativa_status?: string;
  // STC-516/STC-517: obrigatório só na CRIAÇÃO (não em PATCH -- backend
  // ignora o campo em update, ver DocumentoUnidadeWriteSerializer.update())
  // -- por isso opcional aqui, já que este tipo também é usado pra
  // atualizarDocumentoLegalizacao() (Partial<DocumentoUnidadePayload>).
  responsaveis?: number[];
}

// Payload de POST documentos/lote/ (STC-489/STC-490) -- cria 1
// RegraDocumento + N DocumentoUnidade numa transação atômica. Sem
// criticidade escolhida pelo usuário (mesma decisão da STC-486): quem
// monta o payload sempre manda "alta" fixo. Resposta é
// DocumentoUnidade[] (mesmo shape de leitura normal) -- cada item traz o
// identificador em `profissional` (reaproveitamento de coluna, ver
// TipoDocumentoRegulatorio.permite_multiplas_instancias acima).
export interface DocumentoUnidadeLotePayload {
  tipo_documento: number;
  unidade: number;
  vigente_a_partir: string;
  antecedencia_dias: number;
  janela_dia_inicio?: number | null;
  janela_dia_fim?: number | null;
  criticidade: Criticidade;
  gera_card_demanda?: boolean;
  identificadores: string[];
  // STC-516/STC-517: obrigatório -- 1 seleção só, vale pra todos os
  // documentos do lote (não por identificador).
  responsaveis: number[];
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
  // STC-771: comprovantes de protocolo do processo, mais recente primeiro.
  comprovantes_protocolo: ComprovanteProtocolo[];
  // STC-773: card espelho no Kanban; null quando o processo não gerou card.
  card_kanban: CardKanbanDoProcesso | null;
  // STC-778: o lote de renovação de que o processo faz parte, se houver.
  lote: number | null;
  created_at: string;
}

// STC-778: renovação em lote das instâncias de um tipo numa clínica. Cada
// item é o processo de uma instância.
export interface ItemDoLote {
  id: number;
  documento: {
    id: number;
    identificador: string;
    status: StatusDocumento;
    validade: string | null;
  };
  status: StatusProcessoRenovacao;
  data_conclusao: string | null;
  tem_certificado: boolean;
}

export interface LoteRenovacao {
  id: number;
  tipo_documento: { id: number; nome: string };
  unidade: { id: number; nome: string };
  data_solicitacao: string | null;
  usuario_responsavel: Usuario | null;
  protocolo_numero: string;
  protocolo_orgao: string;
  protocolo_data: string | null;
  observacoes: string;
  concluido_em: string | null;
  itens: ItemDoLote[];
  progresso: { concluidos: number; total: number };
  card_kanban: CardKanbanDoProcesso | null;
  created_at: string;
}

export interface IniciarLotePayload {
  documentos: number[];
  data_solicitacao?: string | null;
  usuario_responsavel?: number | null;
}

export interface ProtocoloLotePayload {
  protocolo_numero: string;
  protocolo_orgao?: string;
  protocolo_data?: string | null;
  observacoes?: string;
}

export interface CardKanbanDoProcesso {
  demanda: number;
  status: StatusDemanda;
}

// STC-771: PDF que comprova o pedido feito ao órgão. Separado da evidência:
// não conta como documento regular nem muda status/validade.
export interface ComprovanteProtocolo {
  id: number;
  processo_renovacao: number;
  usuario: Usuario;
  arquivo: string;
  nome_original: string;
  tamanho_bytes: number;
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
// aceitos e todos obrigatórios. `funcao` (client-side, nunca enviada) existe
// só pra guiar a pré-marcação da UI. `profissional` sempre vai pro
// histórico (valor_novo formatado com o nome); pra documentos de tipo
// controlado_por_profissional=True (STC-428), uma "entrada" também grava
// esse valor em DocumentoUnidade.profissional -- "saida" nunca persiste no
// documento (só no histórico), pra não trocar de dono silenciosamente.
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
  /** Rede das unidades (STC-893/894): separa as duas para quem vê as duas. */
  rede?: Rede;
}
