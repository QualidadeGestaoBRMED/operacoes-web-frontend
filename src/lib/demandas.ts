import { isAxiosError } from "axios";
import api from "./api";
import { enviarArquivo, type AoProgredir } from "./uploadDireto";
import type {
  Anexo,
  Categoria,
  Comentario,
  Demanda,
  DemandaFiltros,
  DemandaPayload,
  DemandaResponsavel,
  DemandaStatusPayload,
  Etiqueta,
  HistoricoAlteracao,
  RespostaPaginada,
  ResumoDemandas,
  StatusDemanda,
  TipoGestao,
} from "@/types";

/**
 * Intervalo de atualização do Kanban e da demanda aberta (lista, resumo,
 * detalhe, comentários, histórico e anexos; STC-929). O que a própria pessoa
 * faz aparece na hora (as ações chamam `mutate`), e voltar para a aba busca
 * de novo (padrão do SWR); o que outra pessoa faz aparece em até 30 s numa
 * tela já aberta. Com a aba em segundo plano, nada é buscado.
 */
export const INTERVALO_ATUALIZACAO_DEMANDAS_MS = 30_000;

const MODULO_URL = "/modulos/gestao-demandas/";
const BASE_URL = `${MODULO_URL}demandas/`;

function paramsDeFiltros(filtros?: DemandaFiltros): Record<string, string | number> | undefined {
  if (!filtros) return undefined;

  const params: Record<string, string | number> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    // area_responsavel é lista (STC-391) -- mesmo contrato de
    // AreaResponsavelFilter (backend/demandas/views.py): uma string só,
    // separada por vírgula, não vários params repetidos (o serializador de
    // array padrão do axios não bateria com isso).
    if (Array.isArray(valor)) {
      if (valor.length === 0) continue;
      params[chave] = valor.join(",");
      continue;
    }
    params[chave] = valor;
  }
  return params;
}

/**
 * Primeira página de uma fase (uma coluna do Kanban, STC-931), na ordem da
 * coluna que o backend devolve (STC-930, 30 por página). É a única que a
 * coluna busca de novo a cada atualização.
 */
export async function buscarPrimeiraPaginaDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
): Promise<RespostaPaginada<Demanda>> {
  const { data } = await api.get<RespostaPaginada<Demanda>>(BASE_URL, {
    params: { ...paramsDeFiltros(filtros), status },
  });
  return data;
}

/** As páginas de 2 em diante já carregadas numa coluna. */
export interface PaginasExtrasDaFase {
  demandas: Demanda[];
  /** Até que página veio (a fase pode ter acabado antes da pedida). */
  ate: number;
  temMais: boolean;
}

/**
 * Páginas 2 a `ate` de uma fase, em paralelo (STC-931). O cliente api usa
 * baseURL "/api/backend" de propósito (o token de acesso só existe no proxy):
 * a página é pedida com ?page=N pelo mesmo cliente, nunca pelo "next" do DRF
 * (URL absoluta direto no Django, que sairia sem token). Página que deixou de
 * existir (a fase encolheu) responde 404 e marca o fim.
 */
export async function listarPaginasExtrasDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
  ate: number,
): Promise<PaginasExtrasDaFase> {
  const params = { ...paramsDeFiltros(filtros), status };
  const paginas = Array.from({ length: Math.max(ate - 1, 0) }, (_, indice) => indice + 2);
  const respostas = await Promise.allSettled(
    paginas.map((page) => api.get<RespostaPaginada<Demanda>>(BASE_URL, { params: { ...params, page } })),
  );
  const demandas: Demanda[] = [];
  let ultima = 1;
  let temMais = true;
  for (const resposta of respostas) {
    if (resposta.status === "rejected") {
      if (isAxiosError(resposta.reason) && resposta.reason.response?.status === 404) {
        temMais = false;
        break;
      }
      throw resposta.reason;
    }
    demandas.push(...resposta.value.data.results);
    ultima += 1;
    temMais = Boolean(resposta.value.data.next);
    if (!temMais) break;
  }
  return { demandas, ate: ultima, temMais };
}

/**
 * Junta as páginas de uma coluna sem repetir card. Paginação por offset não
 * é atômica: uma demanda nova entre uma página e outra desloca as seguintes
 * e pode repetir um id; fica a primeira ocorrência.
 */
export function juntarSemRepetir(...listas: Demanda[][]): Demanda[] {
  const vistos = new Set<number>();
  const resultado: Demanda[] = [];
  for (const lista of listas) {
    for (const demanda of lista) {
      if (vistos.has(demanda.id)) continue;
      vistos.add(demanda.id);
      resultado.push(demanda);
    }
  }
  return resultado;
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

// STC-197: mesmo padrão de listarSetores (lib/plataforma.ts) -- moduloId
// opcional escopa a listagem, sem ele cai no catálogo inteiro.
export async function listarEtiquetas(moduloId?: number): Promise<Etiqueta[]> {
  const { data } = await api.get<Etiqueta[]>(`${MODULO_URL}etiquetas/`, {
    params: moduloId ? { modulo: moduloId } : undefined,
  });
  return data;
}

export async function criarEtiqueta(payload: {
  modulo: number;
  nome: string;
  cor: string;
}): Promise<Etiqueta> {
  const { data } = await api.post<Etiqueta>(`${MODULO_URL}etiquetas/`, payload);
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

export async function adicionarResponsavel(
  demandaId: number,
  payload: { usuario_id: number; tipo?: DemandaResponsavel["tipo"] },
): Promise<DemandaResponsavel> {
  const { data } = await api.post<DemandaResponsavel>(
    `${BASE_URL}${demandaId}/responsaveis/`,
    payload,
  );
  return data;
}

// DELETE do backend espera usuario_id no corpo, não no path (o "responsável"
// não tem id próprio útil pro cliente -- é o par demanda+usuario que
// identifica a remoção, mesmo contrato do POST).
export async function removerResponsavel(demandaId: number, usuarioId: number): Promise<void> {
  await api.delete(`${BASE_URL}${demandaId}/responsaveis/`, { data: { usuario_id: usuarioId } });
}

// STC-230/STC-231: antes, trocar o principal era feito com adicionarResponsavel()
// + removerResponsavel() em sequência (2 requisições) -- se a 2ª falhasse depois
// da 1ª ter sucesso, a demanda ficava com dois principais ao mesmo tempo. Essa
// action faz a troca inteira numa única transação no backend.
export async function trocarPrincipalResponsavel(
  demandaId: number,
  antigoUsuarioId: number,
  novoUsuarioId: number,
): Promise<DemandaResponsavel[]> {
  const { data } = await api.post<DemandaResponsavel[]>(
    `${BASE_URL}${demandaId}/responsaveis/trocar-principal/`,
    { antigo_usuario_id: antigoUsuarioId, novo_usuario_id: novoUsuarioId },
  );
  return data;
}

export async function listarAnexos(demandaId: number): Promise<Anexo[]> {
  const { data } = await api.get<Anexo[]>(`${BASE_URL}${demandaId}/anexos/`);
  return data;
}

// Direto ao R2 quando houver (src/lib/uploadDireto.ts): pelo proxy BFF, o
// corpo tem limite de 4,5 MB na Vercel.
export async function enviarAnexo(
  demandaId: number,
  arquivo: File,
  aoProgredir?: AoProgredir,
): Promise<Anexo> {
  return enviarArquivo<Anexo>(`${BASE_URL}${demandaId}/anexos/`, arquivo, aoProgredir);
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
