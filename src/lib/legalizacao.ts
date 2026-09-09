import api from "./api";
import type {
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
  DocumentoUnidadePayload,
  EvidenciaRegulatoria,
  HistoricoRegulatorio,
  ProcessoRenovacao,
  ProcessoRenovacaoPayload,
} from "@/types/legalizacao";

const MODULO_URL = "/modulos/legalizacao/";
const DOCUMENTOS_URL = `${MODULO_URL}documentos/`;
const PROCESSOS_RENOVACAO_URL = `${MODULO_URL}processos-renovacao/`;

// Mesmo motivo de demandas.ts::urlAbsolutaDoAnexo -- ambiente sem R2
// configurado (dev/staging, fallback pra FileSystemStorage) devolve URL
// relativa; sem prefixar, resolveria contra a origem do frontend, não do
// backend que de fato serve o arquivo.
export function urlAbsolutaDaEvidencia(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}

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

// "Mais recente primeiro" (docstring da action no backend) -- não precisa
// ordenar de novo no client.
export async function listarEvidenciasLegalizacao(
  documentoId: number,
): Promise<EvidenciaRegulatoria[]> {
  const { data } = await api.get<EvidenciaRegulatoria[]>(
    `${DOCUMENTOS_URL}${documentoId}/evidencias/`,
  );
  return data;
}

// Sem paginação (mesmo motivo de listarDocumentosLegalizacao) -- histórico
// de um documento só, não cresce sem limite como uma lista de todos os
// documentos.
export async function listarHistoricoLegalizacao(
  documentoId: number,
): Promise<HistoricoRegulatorio[]> {
  const { data } = await api.get<HistoricoRegulatorio[]>(
    `${DOCUMENTOS_URL}${documentoId}/historico/`,
  );
  return data;
}

// POST em si já é o "iniciar" (nasce direto em em_andamento) -- não existe
// um passo de "solicitar" separado. O botão "Registrar renovação" (Detalhe
// do Documento) chama isto direto; a tela de acompanhamento (Protocolo/
// Conclusão) é a STC-381, que opera sobre o processo já criado aqui.
export async function criarProcessoRenovacao(
  payload: ProcessoRenovacaoPayload,
): Promise<ProcessoRenovacao> {
  const { data } = await api.post<ProcessoRenovacao>(
    PROCESSOS_RENOVACAO_URL,
    payload,
  );
  return data;
}
