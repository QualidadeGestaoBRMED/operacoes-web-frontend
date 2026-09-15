import api from "./api";
import type { RespostaPaginada } from "@/types";
import type {
  AlertaRegulatorio,
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
  DocumentoUnidadePayload,
  EvidenciaRegulatoria,
  EvidenciaVigente,
  HistoricoRegulatorio,
  MovimentacaoProfissionalPayload,
  ProcessoRenovacao,
  ProcessoRenovacaoAtualizacaoPayload,
  ProcessoRenovacaoPayload,
} from "@/types/legalizacao";

const MODULO_URL = "/modulos/legalizacao/";
const DOCUMENTOS_URL = `${MODULO_URL}documentos/`;
const PROCESSOS_RENOVACAO_URL = `${MODULO_URL}processos-renovacao/`;
const ALERTAS_URL = `${MODULO_URL}alertas/`;

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

// STC-416 (Biblioteca de Documentos): endpoint agregado, uma linha por
// documento com evidência vigente na unidade -- evita um fetch por
// documento no cliente (ver decisão técnica na issue).
export async function listarEvidenciasVigentes(
  unidadeId: number,
): Promise<EvidenciaVigente[]> {
  const { data } = await api.get<EvidenciaVigente[]>(
    `${DOCUMENTOS_URL}evidencias-vigentes/`,
    { params: { unidade: unidadeId } },
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

// Sem paginação (mesmo motivo de listarHistoricoLegalizacao) -- processos de
// um documento só, no máximo um não-concluído por vez (UniqueConstraint no
// backend) + um histórico curto de concluídos. Mais recente primeiro
// (Meta.ordering do model), então o ativo (se existir) é o 1º não-concluído.
export async function listarProcessosRenovacao(
  documentoUnidadeId: number,
): Promise<ProcessoRenovacao[]> {
  const { data } = await api.get<ProcessoRenovacao[]>(PROCESSOS_RENOVACAO_URL, {
    params: { documento_unidade: documentoUnidadeId },
  });
  return data;
}

// "Salvar protocolo" e "Concluir renovação" (STC-381) usam isto -- PATCH
// parcial, aceita qualquer subconjunto dos campos editáveis do processo.
export async function atualizarProcessoRenovacao(
  id: number,
  payload: ProcessoRenovacaoAtualizacaoPayload,
): Promise<ProcessoRenovacao> {
  const { data } = await api.patch<ProcessoRenovacao>(
    `${PROCESSOS_RENOVACAO_URL}${id}/`,
    payload,
  );
  return data;
}

// Não existe endpoint em lote (STC-382) -- uma chamada por documento
// marcado no modal de Movimentação Profissional, cada uma independente
// (Promise.allSettled no componente, não aqui). Devolve o DocumentoUnidade
// já atualizado (status novo), mesmo shape de leitura de buscarDocumentoLegalizacao.
export async function reportarMovimentacaoProfissional(
  documentoId: number,
  payload: MovimentacaoProfissionalPayload,
): Promise<DocumentoUnidade> {
  const { data } = await api.post<DocumentoUnidade>(
    `${DOCUMENTOS_URL}${documentoId}/movimentacao-profissional/`,
    payload,
  );
  return data;
}

// Sem payload -- o backend recalcula o destino sozinho pela `validade` já
// registrada (STC-430). Não exige justificativa, diferente de
// atualizarDocumentoLegalizacao({status: "nao_aplicavel", ...}).
export async function reverterDocumentoLegalizacao(
  documentoId: number,
): Promise<DocumentoUnidade> {
  const { data } = await api.post<DocumentoUnidade>(
    `${DOCUMENTOS_URL}${documentoId}/reverter/`,
  );
  return data;
}

// STC-443: alertas/ pagina 20 por página no backend (STC-398) -- mesmo
// motivo/limite defensivo de listarDemandas() (demandas.ts): segue ?page=N
// pelo mesmo cliente, nunca o "next" que o DRF devolve (URL absoluta contra
// NEXT_PUBLIC_API_URL, que sairia sem o token do proxy e bateria na CSP
// connect-src 'self'). Alerta pendente acumulado é raro passar de uma
// página na prática, mas o modal de alerta persistente precisa mostrar
// TODOS os pendentes, não só os primeiros 20.
const MAXIMO_DE_PAGINAS_DE_ALERTAS = 50;

// STC-447 (backend) já fecha status_tratamento quando o documento é
// resolvido -- mas só a partir da correção (transições novas) e via uma
// migration pontual pro que já existia até o deploy. Este filtro é defesa
// em profundidade no cliente: mesmo critério da migration de backend
// (não repete ingenuamente "documento resolvido = todos os alertas dele
// somem" -- um documento Regular pode ter um alerta LEGÍTIMO, a varredura
// diária gera alerta pra documento ainda Regular quando a validade entra
// na janela de antecedência).
export function alertaAindaRelevante(alerta: AlertaRegulatorio): boolean {
  const documento = alerta.documento_unidade;
  if (documento.status === "nao_aplicavel" || documento.status === "unidade_encerramento") {
    return false;
  }
  if (documento.status === "regular") {
    if (alerta.imediato) return false;
    return alerta.ciclo_referencia === documento.validade;
  }
  return true;
}

export async function listarAlertasPendentes(): Promise<AlertaRegulatorio[]> {
  const params = { status_tratamento: "pendente" };
  const primeira = await api.get<RespostaPaginada<AlertaRegulatorio>>(ALERTAS_URL, {
    params,
  });
  if (!primeira.data.next) {
    // Achado em code review: o caminho de 1 página só (o comum -- ver
    // comentário acima, alerta pendente acumulado raramente passa de uma
    // página) devolvia direto, sem passar por alertaAindaRelevante -- só o
    // loop de várias páginas abaixo filtrava. Mesmo filtro nos dois
    // caminhos, senão o mesmo alerta aparece ou some dependendo só de
    // quantas páginas a API devolveu, não da regra de negócio.
    return primeira.data.results.filter(alertaAindaRelevante);
  }

  const tamanhoDaPagina = primeira.data.results.length;
  const totalDePaginas = Math.min(
    Math.ceil(primeira.data.count / tamanhoDaPagina),
    MAXIMO_DE_PAGINAS_DE_ALERTAS,
  );
  const demaisPaginas = await Promise.all(
    Array.from({ length: totalDePaginas - 1 }, (_, indice) =>
      api.get<RespostaPaginada<AlertaRegulatorio>>(ALERTAS_URL, {
        params: { ...params, page: indice + 2 },
      }),
    ),
  );

  // Mesmo cuidado de listarDemandas(): paginação por offset não é atômica,
  // um alerta novo gerado pela varredura diária entre uma página e outra
  // desloca as seguintes -- descarta repetição mantendo a 1ª ocorrência.
  const vistos = new Set<number>();
  const resultados: AlertaRegulatorio[] = [];
  for (const { data } of [primeira, ...demaisPaginas]) {
    for (const alerta of data.results) {
      if (vistos.has(alerta.id)) continue;
      vistos.add(alerta.id);
      if (alertaAindaRelevante(alerta)) resultados.push(alerta);
    }
  }
  return resultados;
}
