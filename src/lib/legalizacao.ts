import api from "./api";
import type {
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
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
