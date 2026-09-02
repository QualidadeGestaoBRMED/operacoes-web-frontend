import api from "./api";
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
  TipoGestao,
} from "@/types";

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

// demandas/ pagina 20 por página no backend -- limite defensivo bem acima de
// qualquer board real deste piloto, só pra uma resposta malformada (ex.:
// count absurdo) não disparar milhares de requisições em paralelo de uma vez.
const MAXIMO_DE_PAGINAS_DE_DEMANDAS = 500;

export async function listarDemandas(filtros?: DemandaFiltros): Promise<Demanda[]> {
  const params = paramsDeFiltros(filtros);
  // O cliente api usa baseURL: "/api/backend" de propósito (o token de
  // acesso só existe no server-side do proxy) -- por isso a página seguinte
  // é pedida com ?page=N pelo mesmo cliente, nunca seguindo o "next" que o
  // DRF devolve (URL absoluta apontando direto pro Django via
  // NEXT_PUBLIC_API_URL, que ignoraria o baseURL e sairia sem token).
  const primeira = await api.get<RespostaPaginada<Demanda>>(BASE_URL, { params });
  if (!primeira.data.next) {
    return primeira.data.results;
  }

  const tamanhoDaPagina = primeira.data.results.length;
  const totalDePaginas = Math.min(
    Math.ceil(primeira.data.count / tamanhoDaPagina),
    MAXIMO_DE_PAGINAS_DE_DEMANDAS,
  );
  const demaisPaginas = await Promise.all(
    Array.from({ length: totalDePaginas - 1 }, (_, indice) =>
      api.get<RespostaPaginada<Demanda>>(BASE_URL, {
        params: { ...params, page: indice + 2 },
      }),
    ),
  );

  // Paginação por offset não é atômica: o Kanban é um board ao vivo, com
  // outros usuários criando/excluindo demandas enquanto essa busca roda.
  // Uma criação entre as páginas desloca as seguintes e pode repetir um id
  // em duas páginas -- descarta a repetição mantendo a primeira ocorrência,
  // pra não duplicar card/quebrar key no board. Uma exclusão no mesmo
  // instante pode fazer um id sumir desta busca por um ciclo (o board volta
  // a mostrá-lo no próximo poll de 10s) -- não dá pra evitar isso sem trocar
  // pra paginação por cursor no backend, fora do escopo desta correção.
  const vistos = new Set<number>();
  const resultados: Demanda[] = [];
  for (const { data } of [primeira, ...demaisPaginas]) {
    for (const demanda of data.results) {
      if (vistos.has(demanda.id)) continue;
      vistos.add(demanda.id);
      resultados.push(demanda);
    }
  }
  return resultados;
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
