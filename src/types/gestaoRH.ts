// Contrato das rotas de parâmetros do módulo Gestão RH
// (api/modulos/gestao-rh/, backend gestao_rh/serializers.py). Percentuais
// chegam como string decimal ("5.00"), mesmo formato do DRF.

export type TipoOcorrenciaComputavel = "falta" | "atestado" | "afastamento" | "ausencia";

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
  vigente_a_partir_de: string;
  salvo_por: string | null;
  versao_inicial: boolean;
  created_at: string;
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
