import api from "./api";
import type {
  Anexo,
  Categoria,
  Comentario,
  Demanda,
  DemandaFiltros,
  DemandaPayload,
  DemandaStatusPayload,
  HistoricoAlteracao,
  ResumoDemandas,
  TipoGestao,
} from "@/types";

const MODULO_URL = "/modulos/gestao-demandas/";
const BASE_URL = `${MODULO_URL}demandas/`;

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

// Mover pra lixeira e restaurar ficam de fora do endpoint de status de
// propósito no backend (soft delete via DELETE + /restaurar/ dedicado, não
// PATCH .../status/) -- o Kanban precisa dos dois porque "Lixeira" é uma
// das colunas do board.
export async function excluirDemanda(id: number): Promise<void> {
  await api.delete(`${BASE_URL}${id}/`);
}

export async function restaurarDemanda(id: number): Promise<Demanda> {
  const { data } = await api.post<Demanda>(`${BASE_URL}${id}/restaurar/`);
  return data;
}

export async function buscarResumoDemandas(filtros?: DemandaFiltros): Promise<ResumoDemandas> {
  const { data } = await api.get<ResumoDemandas>(`${MODULO_URL}resumo/`, {
    params: paramsDeFiltros(filtros),
  });
  return data;
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>(`${MODULO_URL}categorias/`);
  return data;
}

export async function listarTiposGestao(): Promise<TipoGestao[]> {
  const { data } = await api.get<TipoGestao[]>(`${MODULO_URL}tipos-gestao/`);
  return data;
}

export async function listarComentarios(demandaId: number): Promise<Comentario[]> {
  const { data } = await api.get<Comentario[]>(`${BASE_URL}${demandaId}/comentarios/`);
  return data;
}

export async function criarComentario(demandaId: number, texto: string): Promise<Comentario> {
  const { data } = await api.post<Comentario>(`${BASE_URL}${demandaId}/comentarios/`, { texto });
  return data;
}

export async function listarHistorico(demandaId: number): Promise<HistoricoAlteracao[]> {
  const { data } = await api.get<HistoricoAlteracao[]>(`${BASE_URL}${demandaId}/historico/`);
  return data;
}

export async function listarAnexos(demandaId: number): Promise<Anexo[]> {
  const { data } = await api.get<Anexo[]>(`${BASE_URL}${demandaId}/anexos/`);
  return data;
}

export async function enviarAnexo(demandaId: number, arquivo: File): Promise<Anexo> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  const { data } = await api.post<Anexo>(`${BASE_URL}${demandaId}/anexos/`, formData);
  return data;
}

export async function excluirAnexo(demandaId: number, anexoId: number): Promise<void> {
  await api.delete(`${BASE_URL}${demandaId}/anexos/${anexoId}/`);
}

// Anexo.arquivo já vem como URL (FileField serializado com use_url) -- mas
// relativa em dev local (FileSystemStorage só conhece MEDIA_URL, sem host) e
// absoluta em produção (S3Boto3Storage/R2 sempre devolve URL completa). Sem
// isso, um link relativo resolveria contra a origem do FRONTEND, não do
// backend Django que de fato serve o arquivo.
export function urlAbsolutaDoAnexo(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}
