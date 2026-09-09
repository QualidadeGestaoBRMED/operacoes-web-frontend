import api from "./api";
import type {
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
  DocumentoUnidadePayload,
  EvidenciaRegulatoria,
} from "@/types/legalizacao";

const MODULO_URL = "/modulos/legalizacao/";
const DOCUMENTOS_URL = `${MODULO_URL}documentos/`;

function paramsDeFiltros(
  filtros?: DocumentoUnidadeFiltros,
): Record<string, string | number> | undefined {
  if (!filtros) return undefined;

  const params: Record<string, string | number> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    params[chave] = valor;
  }
  return params;
}

// DocumentoUnidadeViewSet não pagina (catálogo -- matriz de conformidade
// completa por unidade, sem crescimento não-limitado no tempo como
// demandas/alertas -- ver core/pagination.py no backend).
export async function listarDocumentosLegalizacao(
  filtros?: DocumentoUnidadeFiltros,
): Promise<DocumentoUnidade[]> {
  const { data } = await api.get<DocumentoUnidade[]>(DOCUMENTOS_URL, {
    params: paramsDeFiltros(filtros),
  });
  return data;
}

export async function buscarDocumentoLegalizacao(
  id: number,
): Promise<DocumentoUnidade> {
  const { data } = await api.get<DocumentoUnidade>(`${DOCUMENTOS_URL}${id}/`);
  return data;
}

// DocumentoUnidadeViewSet.create() já devolve o shape de leitura completo
// (tipo_documento/unidade/regra_aplicada aninhados), não o payload cru --
// ver create() em legalizacao/views.py (reserializa de propósito).
export async function criarDocumentoLegalizacao(
  payload: DocumentoUnidadePayload,
): Promise<DocumentoUnidade> {
  const { data } = await api.post<DocumentoUnidade>(DOCUMENTOS_URL, payload);
  return data;
}

// Usado hoje só pra recolocar `regra_aplicada` depois de uma nova versão de
// regra (RegraDocumento é append-only) -- PATCH parcial, aceita qualquer
// subconjunto dos campos editáveis.
export async function atualizarDocumentoLegalizacao(
  id: number,
  payload: Partial<DocumentoUnidadePayload>,
): Promise<DocumentoUnidade> {
  const { data } = await api.patch<DocumentoUnidade>(
    `${DOCUMENTOS_URL}${id}/`,
    payload,
  );
  return data;
}

export async function enviarEvidenciaLegalizacao(
  documentoId: number,
  arquivo: File,
): Promise<EvidenciaRegulatoria> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  const { data } = await api.post<EvidenciaRegulatoria>(
    `${DOCUMENTOS_URL}${documentoId}/evidencias/`,
    formData,
  );
  return data;
}
