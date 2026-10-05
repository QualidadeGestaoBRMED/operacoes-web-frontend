import { isAxiosError } from "axios";
import api from "./api";
import type {
  MarcoEditado,
  NovaVersaoParametrosPayload,
  ParametrosAbsenteismoResposta,
  ReguaFeriasResposta,
  ResultadoSalvar,
  TipoMarcoEditavel,
  TipoOcorrenciaComputavel,
  VersaoParametrosAbsenteismo,
} from "@/types/gestaoRH";

const MODULO_URL = "/modulos/gestao-rh/";
const PARAMETROS_URL = `${MODULO_URL}parametros/`;
const REGUA_URL = `${MODULO_URL}regua-ferias/`;

export async function buscarParametrosAbsenteismo(): Promise<ParametrosAbsenteismoResposta> {
  const { data } = await api.get<ParametrosAbsenteismoResposta>(PARAMETROS_URL);
  return data;
}

export async function salvarParametrosAbsenteismo(
  payload: NovaVersaoParametrosPayload,
): Promise<ResultadoSalvar<ParametrosAbsenteismoResposta>> {
  const resposta = await api.post<ParametrosAbsenteismoResposta>(PARAMETROS_URL, payload);
  return { dados: resposta.data, criouVersao: resposta.status === 201 };
}

export async function buscarReguaFerias(): Promise<ReguaFeriasResposta> {
  const { data } = await api.get<ReguaFeriasResposta>(REGUA_URL);
  return data;
}

export async function salvarReguaFerias(
  marcos: MarcoEditado[],
): Promise<ResultadoSalvar<ReguaFeriasResposta>> {
  const resposta = await api.post<ReguaFeriasResposta>(REGUA_URL, { marcos });
  return { dados: resposta.data, criouVersao: resposta.status === 201 };
}

export const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrenciaComputavel, string> = {
  falta: "Falta",
  atestado: "Atestado",
  afastamento: "Afastamento",
  ausencia: "Ausência",
};

export const TIPOS_OCORRENCIA_COMPUTAVEIS = Object.keys(
  ROTULO_TIPO_OCORRENCIA,
) as TipoOcorrenciaComputavel[];

/**
 * Marcos editáveis na tela, na ordem do mockup. "Limite vencido" não
 * aparece: é fixo na API. "Completou o período" não tem campo de dias (o
 * alerta sai no dia em que o período completa).
 */
export const MARCOS_DA_TELA: {
  tipo: TipoMarcoEditavel;
  rotulo: string;
  descricao: string;
  temDias: boolean;
}[] = [
  {
    tipo: "completou_periodo",
    rotulo: "Completou o período de direito",
    descricao: "Colaborador completou 1 ano de trabalho no período: programar as férias",
    temDias: false,
  },
  {
    tipo: "antes_do_limite",
    rotulo: "dias antes do limite para tirar",
    descricao: "Repetição quando as férias ainda não foram programadas",
    temDias: true,
  },
  {
    tipo: "antes_do_inicio_substituicao",
    rotulo: "dias antes do início das férias",
    descricao: "Prazo para acionar o RH quando houver substituição",
    temDias: true,
  },
];

/** "2026-10-05" → "05/10/2026", sem passar por Date (evita deslocar o dia pelo fuso). */
export function formatarDataISO(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function textoVersaoVigente(versao: VersaoParametrosAbsenteismo): string {
  if (versao.versao_inicial) return "Versão inicial";
  const desde = `Versão vigente desde ${formatarDataISO(versao.vigente_a_partir_de)}`;
  return versao.salvo_por ? `${desde}, por ${versao.salvo_por}` : desde;
}

/** "5.00" → "5"; "5.50" → "5.5". Para exibir e preencher os campos de %. */
export function percentualParaCampo(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return String(Number(valor));
}

function mensagens(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(mensagens);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(mensagens);
  return [];
}

/**
 * Erros de validação do DRF (400) por campo de primeiro nível, com as
 * mensagens aninhadas achatadas (ex.: `faixas.non_field_errors`,
 * `marcos[1].dias`). Vazio quando não é um 400 com corpo de campos.
 */
export function errosDeCampo(erro: unknown): Record<string, string> {
  if (!isAxiosError(erro) || erro.response?.status !== 400) return {};
  const dados: unknown = erro.response.data;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return {};
  const porCampo: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(dados)) {
    const texto = mensagens(valor).join(" ");
    if (texto) porCampo[campo] = texto;
  }
  return porCampo;
}
