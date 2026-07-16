import api from "./api";
import type { Demanda, DemandaFiltros, DemandaPayload, DemandaStatusPayload } from "@/types";

const BASE_URL = "/modulos/gestao-demandas/demandas/";

function paramsDeFiltros(filtros?: DemandaFiltros): Record<string, string | number> | undefined {
  if (!filtros) return undefined;

  const params: Record<string, string | number> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      params[chave] = valor;
    }
  }
  return params;
}

export async function listarDemandas(filtros?: DemandaFiltros): Promise<Demanda[]> {
  const { data } = await api.get<Demanda[]>(BASE_URL, { params: paramsDeFiltros(filtros) });
  return data;
}

export async function buscarDemanda(id: number): Promise<Demanda> {
  const { data } = await api.get<Demanda>(`${BASE_URL}${id}/`);
  return data;
}

export async function criarDemanda(payload: DemandaPayload): Promise<Demanda> {
  const { data } = await api.post<Demanda>(BASE_URL, payload);
  return data;
}

export async function atualizarDemanda(
  id: number,
  payload: Partial<DemandaPayload>,
): Promise<Demanda> {
  const { data } = await api.patch<Demanda>(`${BASE_URL}${id}/`, payload);
  return data;
}

export async function atualizarStatusDemanda(
  id: number,
  payload: DemandaStatusPayload,
): Promise<Demanda> {
  const { data } = await api.patch<Demanda>(`${BASE_URL}${id}/status/`, payload);
  return data;
}
