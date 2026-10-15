import api from "./api";
import { unidadeOuEquipe } from "./gestaoRHAbsenteismo";
import { ordenarPor, type Ordenacao } from "./ordenacao";
import type {
  FatorHoraExtra,
  FiltrosPainelHorasExtras,
  LinhaHorasExtras,
  MinutosDoFator,
  PainelHorasExtras,
} from "@/types/gestaoRH";

const PAINEL_URL = "/modulos/gestao-rh/horas-extras/";

/** Painel de Horas Extras (rota da STC-739). */
export async function buscarPainelHorasExtras(
  filtros: FiltrosPainelHorasExtras,
): Promise<PainelHorasExtras> {
  const { data } = await api.get<PainelHorasExtras>(PAINEL_URL, { params: filtros });
  return data;
}

const FORMATADOR_HORAS = new Intl.NumberFormat("pt-BR");

/**
 * Duração em horas:minutos:segundos, com ponto de milhar nas horas: 5875 →
 * "97:55:00"; 81352 → "1.355:52:00". O VR conta em minutos, então os
 * segundos são sempre "00". Horas decimais ("105,7 h") parecem minutos
 * ("105h70") e não batem com o VR.
 */
export function formatarHoras(minutos: number): string {
  const horas = FORMATADOR_HORAS.format(Math.floor(minutos / 60));
  return `${horas}:${String(minutos % 60).padStart(2, "0")}:00`;
}

/** Marca do eixo dos gráficos, em horas inteiras: 1500 → "1.500h". */
export function formatarHorasDoEixo(horas: number): string {
  return `${FORMATADOR_HORAS.format(horas)}h`;
}

/** "50%" pelo percentual que a rota leu do VR; "Fator 1" sem ele. */
export function rotuloDoFator(fator: FatorHoraExtra, painel: PainelHorasExtras | undefined): string {
  const percentual = painel?.fatores.find((item) => item.fator === fator)?.percentual;
  return percentual ? `${percentual.replace(".", ",")}%` : `Fator ${fator}`;
}

export function minutosDoFator(minutos: MinutosDoFator[], fator: FatorHoraExtra): number {
  return minutos.find((item) => item.fator === fator)?.minutos ?? 0;
}

export type CampoOrdenavelHorasExtras =
  | "colaborador"
  | "unidade"
  | "fator_1"
  | "fator_2"
  | "total"
  | "dias";

export type OrdenacaoHorasExtras = Ordenacao<CampoOrdenavelHorasExtras>;

const CHAVES_HORAS_EXTRAS = {
  colaborador: (linha: LinhaHorasExtras) => linha.colaborador.nome,
  unidade: (linha: LinhaHorasExtras) => unidadeOuEquipe(linha),
  fator_1: (linha: LinhaHorasExtras) => minutosDoFator(linha.minutos_por_fator, "1"),
  fator_2: (linha: LinhaHorasExtras) => minutosDoFator(linha.minutos_por_fator, "2"),
  total: (linha: LinhaHorasExtras) => linha.total_minutos,
  dias: (linha: LinhaHorasExtras) => linha.dias_com_hora_extra,
};

/** Sem ordenação escolhida, mantém a ordem da API (mais horas primeiro). */
export function ordenarLinhasHorasExtras(
  linhas: LinhaHorasExtras[],
  ordenacao: OrdenacaoHorasExtras | null,
): LinhaHorasExtras[] {
  return ordenarPor(linhas, ordenacao, CHAVES_HORAS_EXTRAS);
}
