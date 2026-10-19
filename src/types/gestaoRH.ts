// Contrato das rotas de parâmetros do módulo Gestão RH
// (api/modulos/gestao-rh/, backend gestao_rh/serializers.py). Percentuais
// chegam como string decimal ("5.00"), mesmo formato do DRF.

export type TipoOcorrenciaComputavel = "falta" | "atestado" | "ausencia";

export interface FaixasAbsenteismo {
  atencao_a_partir_de: string;
  critica_acima_de: string;
}

export interface VersaoParametrosAbsenteismo {
  id: number;
  limite_atraso_minutos: number;
  tipos_computados: TipoOcorrenciaComputavel[];
  meta_percentual: string | null;
  faixas: FaixasAbsenteismo | null;
  /** Janela da avaliação automática; nula, a avaliação está desligada. */
  janela_avaliacao: JanelaAvaliacao | null;
  vigente_a_partir_de: string;
  salvo_por: string | null;
  versao_inicial: boolean;
  created_at: string;
}

export type TipoJanelaAvaliacao = "mes_anterior_fechado" | "ultimos_dias";

/** "Mês anterior fechado" vem com `dias: null`; "últimos N dias", com N de 7 a 90. */
export interface JanelaAvaliacao {
  tipo: TipoJanelaAvaliacao;
  dias: number | null;
}

export interface ParametrosAbsenteismoResposta {
  vigente: VersaoParametrosAbsenteismo | null;
  versoes: VersaoParametrosAbsenteismo[];
}

export interface NovaVersaoParametrosPayload {
  limite_atraso_minutos: number;
  meta_percentual: string | null;
  faixas: FaixasAbsenteismo | null;
  tipos_computados: TipoOcorrenciaComputavel[];
  /** Null desliga a avaliação automática. Ausente mantém a atual. */
  janela_avaliacao?: { tipo: TipoJanelaAvaliacao; dias?: number } | null;
}

// Equipes do VR (rotas da STC-691, só Admin).

export type CategoriaEquipeVR =
  | "unidade"
  | "operacoes_especiais"
  | "fora_do_indicador"
  | "sem_categoria";

export interface EquipeVR {
  id: number;
  nome: string;
  categoria: CategoriaEquipeVR;
  categoria_rotulo: string;
  unidade: { id: number; nome: string } | null;
  colaboradores_ativos: number;
  /** Lote em que a equipe apareceu; nulo nas da carga inicial. */
  criada_na_importacao: number | null;
  /** Absenteísmo do dia pela carga horária cumprida, não pela escala. */
  turno_variavel: boolean;
}

/** PATCH da equipe: campo ausente mantém o valor atual. */
export interface ReclassificarEquipePayload {
  categoria?: CategoriaEquipeVR;
  /**
   * Unidade: obrigatória, da rede própria. Operações Especiais: opcional, da
   * rede OPEX. Nas outras, nula.
   */
  unidade?: number | null;
  turno_variavel?: boolean;
}

export type TipoMarcoRegua =
  | "completou_periodo"
  | "antes_do_limite"
  | "antes_do_inicio_substituicao"
  | "limite_vencido";

export type TipoMarcoEditavel = Exclude<TipoMarcoRegua, "limite_vencido">;

export interface VersaoMarcoRegua {
  id: number;
  tipo_marco: TipoMarcoRegua;
  rotulo: string;
  dias: number;
  ativo: boolean;
  editavel: boolean;
  vigente_a_partir_de: string;
  salvo_por: string | null;
  versao_inicial: boolean;
  created_at: string;
}

export interface ReguaFeriasResposta {
  marcos: VersaoMarcoRegua[];
  versoes: VersaoMarcoRegua[];
}

export interface MarcoEditado {
  tipo_marco: TipoMarcoEditavel;
  dias: number;
  ativo: boolean;
}

/** Resposta de um salvar: a API devolve 200 (sem mudança) ou 201 (versão nova). */
export interface ResultadoSalvar<T> {
  dados: T;
  criouVersao: boolean;
}

// Férias (rotas da STC-591). Datas "AAAA-MM-DD"; data e hora em ISO.

export type StatusPeriodoFerias =
  | "pendente"
  | "programado"
  | "programacao_adiada"
  | "ferias_tiradas"
  | "limite_vencido";

export interface UnidadeResumoRH {
  id: number;
  nome: string;
}

export interface ColaboradorResumoRH {
  id: number;
  nome: string;
  matricula_vr: string;
  cargo: string;
  /** Nula enquanto o colaborador não tiver unidade do Atlas. */
  unidade: UnidadeResumoRH | null;
}

export interface ProgramacaoFerias {
  id: number;
  data_inicio: string;
  data_fim: string;
  dias: number;
  necessita_substituicao: boolean;
  data_limite_substituicao: string | null;
  rh_acionado_em: string | null;
  rh_acionado_por: string | null;
}

export type TipoProximoMarco =
  | "completou_periodo"
  | "antes_do_limite"
  | "limite"
  | "acionar_rh"
  | "inicio_ferias";

export interface ProximoMarco {
  tipo: TipoProximoMarco;
  rotulo: string;
  data: string;
}

export interface PeriodoResumo {
  id: number;
  inicio_aquisitivo: string;
  fim_aquisitivo: string;
  limite_concessivo: string;
  status: StatusPeriodoFerias;
}

export interface LinhaPainelFerias {
  colaborador: ColaboradorResumoRH;
  periodo: PeriodoResumo;
  outros_periodos_pendentes: number;
  proximo_marco: ProximoMarco | null;
  limite_vencido_ha_dias: number | null;
  programacao: ProgramacaoFerias | null;
  demandas_abertas: number;
}

export interface CardsFerias {
  limite_vencido: number;
  perto_do_limite: number;
  dias_perto_do_limite: number;
  sem_programacao: number;
  substituicao_a_acionar: number;
  programacao_adiada: number;
  alertas_na_janela: number;
  demandas_na_janela: number;
  ultima_importacao: string | null;
}

export interface PainelFerias {
  linhas: LinhaPainelFerias[];
  cards: CardsFerias;
}

export interface FiltrosPainelFerias {
  janela_dias: number;
  unidade?: number;
  status?: StatusPeriodoFerias;
}

export interface CabecalhoColaborador extends ColaboradorResumoRH {
  /** Equipe do VR; nula enquanto o colaborador não tiver equipe. */
  equipe?: string | null;
  categoria?: CategoriaEquipeVR | null;
  data_admissao: string | null;
  ativo: boolean;
  alertas_pendentes: { ferias: number; absenteismo: number };
}

export type SituacaoMarco =
  | "alerta_gerado"
  | "tratado"
  | "proximo"
  | "futuro"
  | "sem_alerta"
  | "vencido";

export interface MarcoDoPeriodo {
  tipo: "completou_periodo" | "antes_do_limite" | "limite";
  rotulo: string;
  data: string;
  situacao: SituacaoMarco;
  demanda_id: number | null;
}

export interface PeriodoComProgramacao extends PeriodoResumo {
  programacao: ProgramacaoFerias | null;
}

export interface PeriodoPendente extends PeriodoComProgramacao {
  direito_adquirido_em: string;
  limite_vencido_ha_dias: number | null;
  marcos: MarcoDoPeriodo[];
  adiamento: { justificativa: string; em: string | null; por: string | null } | null;
  pode_programar: boolean;
  pode_adiar: boolean;
  pode_registrar_rh_acionado: boolean;
}

export interface RegistroHistoricoRH {
  acao: string;
  valor_anterior: string;
  valor_novo: string;
  justificativa: string;
  regra_gatilho: string;
  por: string | null;
  automatico: boolean;
  em: string;
  /** Período de férias do registro, quando a API informa. */
  periodo?: { inicio_aquisitivo: string; fim_aquisitivo: string } | null;
}

export interface FeriasColaborador {
  periodos_pendentes: PeriodoPendente[];
  ferias_tiradas: PeriodoComProgramacao[];
  periodo_em_andamento: {
    id: number;
    inicio_aquisitivo: string;
    fim_aquisitivo: string;
    direito_a_partir_de: string;
  } | null;
  /**
   * Antecedência do prazo para acionar o RH, pela régua vigente; nulo com o
   * marco desativado, ausente quando a API não informa.
   */
  dias_antes_do_inicio_substituicao?: number | null;
  historico: RegistroHistoricoRH[];
}

export interface ProgramarFeriasPayload {
  data_inicio: string;
  data_fim: string;
  necessita_substituicao: boolean;
}

// Absenteísmo: contrato de GET /api/modulos/gestao-rh/absenteismo/, fixado
// na STC-588 antes do backend existir. Percentuais como string decimal;
// minutos como inteiro.

export type FaixaAbsenteismo = "critica" | "atencao";

export type OcorrenciaFiltro =
  | "falta"
  | "atestado"
  | "afastamento"
  | "ausencia"
  | "atraso"
  | "saida_antecipada"
  | "jornada_incompleta";

export interface FiltrosPainelAbsenteismo {
  inicio: string;
  fim: string;
  unidade?: number;
  faixa?: FaixaAbsenteismo[];
  ocorrencia?: OcorrenciaFiltro[];
  com_pendencias?: boolean;
}

export interface LinhaPainelAbsenteismo {
  colaborador: ColaboradorResumoRH;
  /** Equipe do VR, mostrada se o colaborador ainda não tiver unidade. */
  equipe: string;
  percentual: string | null;
  faixa: FaixaAbsenteismo | null;
  provisorio: boolean;
  pendencias: number;
  dias_trabalhados: number;
  dias_previstos: number;
  conformidade_percentual: string | null;
  faltas: number;
  atestados: number;
  afastamentos: number;
  ausencias: number;
  atrasos_acima_do_limite: number;
  saidas_acima_do_limite: number;
  /**
   * Equipe de turno variável: dias em que faltou mais que o limite da carga do
   * dia. Opcional: backend anterior à STC-734 não manda o campo.
   */
  jornadas_incompletas?: number;
  banco_horas_saldo_minutos: number;
  banco_horas_uso_minutos: number;
  demanda_aberta: boolean;
}

export interface CardsAbsenteismo {
  percentual_periodo: string | null;
  faixa_critica: number;
  faixa_atencao: number;
  pendencias: number;
  colaboradores_provisorios: number;
  colaboradores: number;
  unidades: number;
  ultima_importacao: string | null;
  /** Mesma regra do aviso aos Admins: nenhum lote concluído desde ontem. */
  importacao_parada: boolean;
  dados_ate: string | null;
}

/** Um mês do absenteísmo mês a mês (rota da STC-748): os cards do Painel no mês inteiro. */
export interface MesAbsenteismoMensal {
  /** 1 a 12. */
  mes: number;
  inicio: string;
  fim: string;
  /** Começa depois de hoje: números nulos. */
  futuro: boolean;
  /** Da versão dos parâmetros vigente hoje, igual em todos os meses. */
  meta_percentual: string | null;
  faixas_cadastradas: boolean;
  /** Nulo sem dado no mês ou no mês futuro. */
  percentual_periodo: string | null;
  faixa_critica: number | null;
  faixa_atencao: number | null;
  colaboradores_provisorios: number | null;
}

export interface AbsenteismoMensal {
  ano: number;
  parametros: {
    meta_percentual: string | null;
    faixas_cadastradas: boolean;
    /**
     * Desde quando vale a versão dos parâmetros usada na conta (a vigente hoje,
     * para qualquer período). Nula na versão inicial, que ninguém configurou.
     */
    vigente_a_partir_de: string | null;
  };
  /** Último dia com jornada importada de quem a pessoa vê. */
  dados_ate: string | null;
  meses: MesAbsenteismoMensal[];
}

export interface FiltrosAbsenteismoMensal {
  ano: number;
  unidade?: number;
}

export interface PainelAbsenteismo {
  periodo: { inicio: string; fim: string };
  parametros: {
    meta_percentual: string | null;
    faixas_cadastradas: boolean;
    limite_atraso_minutos: number;
    vigente_a_partir_de: string | null;
  };
  cards: CardsAbsenteismo;
  linhas: LinhaPainelAbsenteismo[];
}

// Aba Absenteísmo do modal: contrato de GET .../colaboradores/{id}/absenteismo/
// e POST .../colaboradores/{id}/tratamentos/, fixado na STC-592.

export type TipoOcorrenciaAbsenteismo = OcorrenciaFiltro | "banco_horas";

export interface OcorrenciaAbsenteismo {
  tipo: TipoOcorrenciaAbsenteismo;
  inicio: string;
  fim: string;
  dias: number | null;
  minutos: number | null;
  conta_no_absenteismo: boolean | null;
  em_aprovacao: boolean;
  justificada: boolean | null;
}

export type AcaoTratamento = "feedback" | "advertencia" | "desligamento" | "sem_medida";

export interface AlertaAbsenteismo {
  id: number;
  periodo_inicio: string;
  periodo_fim: string;
  faixa: FaixaAbsenteismo;
  /**
   * Limite da faixa crítica na versão dos parâmetros que gerou o alerta. Os
   * indicadores usam a versão de hoje e podem não estar mais em crítica.
   */
  critica_acima_de: number | null;
  /** Havia pendência de ponto em aberto quando o alerta foi gerado. */
  provisorio: boolean;
  gerado_em: string;
  demanda_id: number | null;
  demanda_aberta: boolean;
  /** Quem está com a demanda hoje: a coordenação, o Admin que ficou com ela ou "Admins". */
  responsavel: string | null;
  /**
   * Falso com `tratamento` nulo: o alerta foi encerrado por uma importação
   * seguinte (saiu da faixa crítica).
   */
  pode_registrar_tratamento: boolean;
  tratamento: { acao: AcaoTratamento; justificativa: string; por: string | null; em: string } | null;
}

export interface AbsenteismoColaborador {
  periodo: { inicio: string; fim: string };
  parametros: {
    faixas_cadastradas: boolean;
    limite_atraso_minutos: number;
    vigente_a_partir_de: string | null;
  };
  indicadores: {
    percentual: string | null;
    faixa: FaixaAbsenteismo | null;
    provisorio: boolean;
    pendencias: number;
    dias_trabalhados: number;
    dias_previstos: number;
    conformidade_percentual: string | null;
    banco_horas_saldo_minutos: number;
    banco_horas_uso_minutos: number;
  };
  ocorrencias: OcorrenciaAbsenteismo[];
  alertas: AlertaAbsenteismo[];
  historico: RegistroHistoricoRH[];
}

export interface RegistrarTratamentoPayload {
  alerta: number;
  acao: AcaoTratamento;
  justificativa: string;
}

// Painel de Horas Extras: contrato de GET /api/modulos/gestao-rh/horas-extras/,
// fixado na STC-739. Valores em minutos.

export type FatorHoraExtra = "1" | "2";

export interface FiltrosPainelHorasExtras {
  inicio: string;
  fim: string;
  unidade?: number;
}

export interface MinutosDoFator {
  fator: FatorHoraExtra;
  minutos: number;
}

export interface LinhaHorasExtras {
  colaborador: ColaboradorResumoRH;
  /** Equipe do VR, mostrada se o colaborador ainda não tiver unidade. */
  equipe: string;
  minutos_por_fator: MinutosDoFator[];
  total_minutos: number;
  dias_com_hora_extra: number;
}

export interface UnidadeHorasExtras {
  unidade_id: number;
  nome: string;
  minutos_por_fator: MinutosDoFator[];
  total_minutos: number;
}

export interface PainelHorasExtras {
  periodo: { inicio: string; fim: string };
  /** Falso quando os lotes do período não trazem as colunas de hora extra. */
  com_dado: boolean;
  /** Só parte dos dias do período traz as colunas: os totais não contam os outros. */
  parcial: boolean;
  /** Percentual de cada fator, do título da coluna do VR ("50"); nulo sem dado. */
  fatores: { fator: FatorHoraExtra; percentual: string | null }[];
  cards: {
    total_minutos: number;
    minutos_por_fator: MinutosDoFator[];
    colaboradores_com_hora_extra: number;
  };
  /** Só quem teve hora extra, com mais horas primeiro. */
  linhas: LinhaHorasExtras[];
  por_unidade: UnidadeHorasExtras[];
}
