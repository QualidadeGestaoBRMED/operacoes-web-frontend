import api from "./api";
import { enviarArquivo, type AoProgredir } from "./uploadDireto";
import type { Comentario, RespostaPaginada, Usuario } from "@/types";
import type {
  AlertaRegulatorio,
  ComprovanteProtocolo,
  IniciarLotePayload,
  LoteRenovacao,
  ProtocoloLotePayload,
  DocumentoUnidade,
  DocumentoUnidadeAtualizado,
  DocumentoUnidadeFiltros,
  DocumentoUnidadeLotePayload,
  DocumentoUnidadePayload,
  EvidenciaRegulatoria,
  EvidenciaVigente,
  HistoricoRegulatorio,
  MovimentacaoProfissionalPayload,
  ProcessoRenovacao,
  ProcessoRenovacaoAtualizacaoPayload,
  ProcessoRenovacaoPayload,
  ResponsavelDocumento,
  ResponsavelDocumentoPayload,
} from "@/types/legalizacao";

const MODULO_URL = "/modulos/legalizacao/";
const DOCUMENTOS_URL = `${MODULO_URL}documentos/`;
const PROCESSOS_RENOVACAO_URL = `${MODULO_URL}processos-renovacao/`;
const ALERTAS_URL = `${MODULO_URL}alertas/`;
const LOTES_URL = `${MODULO_URL}lotes-renovacao/`;

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

// STC-489/STC-490: cria 1 RegraDocumento + N DocumentoUnidade numa
// transação atômica -- resposta é a lista completa (uma por identificador).
export async function criarDocumentosLegalizacaoEmLote(
  payload: DocumentoUnidadeLotePayload,
): Promise<DocumentoUnidade[]> {
  const { data } = await api.post<DocumentoUnidade[]>(`${DOCUMENTOS_URL}lote/`, payload);
  return data;
}

// STC-516/STC-517: candidatos a responsável operacional = usuários da
// unidade OU do setor de apoio do tipo de documento (união, calculada no
// backend) -- popula o multi-select de FormCadastrarDocumento.tsx/
// FormCadastrarDocumentosEmLote.tsx.
export async function listarCandidatosResponsaveis(
  unidade: number,
  tipoDocumento: number,
): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>(`${DOCUMENTOS_URL}candidatos-responsaveis/`, {
    params: { unidade, tipo_documento: tipoDocumento },
  });
  return data;
}

// STC-518: endpoint já existia no backend (POST/DELETE
// documentos/{id}/responsaveis/) desde antes da STC-516, sem cliente no
// frontend até aqui -- só usado via API direta. `principal` default do
// model é True; quem chama decide explicitamente (documento sem nenhum
// responsável ainda -> True, senão False, pra não colidir com
// uniq_responsavel_principal_por_documento).
export async function adicionarResponsavelLegalizacao(
  documentoId: number,
  payload: ResponsavelDocumentoPayload,
): Promise<ResponsavelDocumento> {
  const { data } = await api.post<ResponsavelDocumento>(
    `${DOCUMENTOS_URL}${documentoId}/responsaveis/`,
    payload,
  );
  return data;
}

// DELETE com corpo -- diferente do padrão REST usual (id na URL), mas é
// assim que o endpoint já existia no backend (usuario_id vem no body, não
// dá pra mudar sem quebrar contrato).
export async function removerResponsavelLegalizacao(
  documentoId: number,
  usuarioId: number,
): Promise<void> {
  await api.delete(`${DOCUMENTOS_URL}${documentoId}/responsaveis/`, {
    data: { usuario_id: usuarioId },
  });
}

// Usado hoje só pra recolocar `regra_aplicada` depois de uma nova versão de
// regra (RegraDocumento é append-only) -- PATCH parcial, aceita qualquer
// subconjunto dos campos editáveis.
// STC-702 (backend): apaga o documento com evidências, histórico, processos
// de renovação, card no Kanban e notificações. 204 sem corpo.
// STC-853: no lugar da exclusão; só Admin da rede do documento.
export async function desativarDocumentoLegalizacao(
  id: number,
  justificativa: string,
): Promise<void> {
  await api.post(`${DOCUMENTOS_URL}${id}/desativar/`, { justificativa });
}

export async function atualizarDocumentoLegalizacao(
  id: number,
  payload: Partial<DocumentoUnidadePayload>,
): Promise<DocumentoUnidadeAtualizado> {
  const { data } = await api.patch<DocumentoUnidadeAtualizado>(
    `${DOCUMENTOS_URL}${id}/`,
    payload,
  );
  return data;
}

// Direto ao R2 quando houver (src/lib/uploadDireto.ts): pelo proxy BFF, o
// corpo tem limite de 4,5 MB na Vercel.
// `troca` (STC-853, "Editar anexo"): troca o PDF vigente por este, sem
// renovação; o anterior fica guardado no histórico de evidências.
export async function enviarEvidenciaLegalizacao(
  documentoId: number,
  arquivo: File,
  aoProgredir?: AoProgredir,
  troca?: { justificativa: string },
): Promise<EvidenciaRegulatoria> {
  return enviarArquivo<EvidenciaRegulatoria>(
    `${DOCUMENTOS_URL}${documentoId}/evidencias/`,
    arquivo,
    aoProgredir,
    troca ? { substituir: true, justificativa_substituicao: troca.justificativa } : {},
  );
}

export type VisualizacaoEvidencia = { modo: "direto"; url: string } | { modo: "proxy" };

// STC-628: URL assinada (5 min) que mostra o PDF da evidência vigente direto
// do R2, sem passar pela função da Vercel (limite de 4,5 MB na resposta).
// "proxy": sem R2 (dev, E2E), segue pelo /api/media/evidencia-vigente.
export async function obterVisualizacaoEvidenciaVigente(
  documentoId: number,
): Promise<VisualizacaoEvidencia> {
  const { data } = await api.get<VisualizacaoEvidencia>(
    `${DOCUMENTOS_URL}${documentoId}/evidencia-vigente/visualizacao/`,
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

// Backend de produção sem a STC-771, a STC-773 ou a STC-778 (sobe por deploy
// manual; o frontend pode chegar antes): o processo vem sem
// `comprovantes_protocolo`, `card_kanban` ou `lote`, e ler `.length` do
// primeiro quebraria o detalhe de qualquer documento. Lista vazia, sem card
// e sem lote até o backend subir.
function normalizarProcesso(processo: ProcessoRenovacao): ProcessoRenovacao {
  return {
    ...processo,
    comprovantes_protocolo: processo.comprovantes_protocolo ?? [],
    card_kanban: processo.card_kanban ?? null,
    lote: processo.lote ?? null,
  };
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
  return normalizarProcesso(data);
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
  return data.map(normalizarProcesso);
}

// STC-772: mesmo envio da evidência (direto ao R2 quando houver).
export async function enviarComprovanteProtocolo(
  processoId: number,
  arquivo: File,
  aoProgredir?: AoProgredir,
): Promise<ComprovanteProtocolo> {
  return enviarArquivo<ComprovanteProtocolo>(
    `${PROCESSOS_RENOVACAO_URL}${processoId}/comprovantes-protocolo/`,
    arquivo,
    aoProgredir,
  );
}

// STC-804: a conversa do documento, uma só ao longo do tempo, com ou sem
// renovação aberta.
export async function listarComentariosDoDocumento(
  documentoId: number,
): Promise<Comentario[]> {
  const { data } = await api.get<Comentario[]>(
    `${DOCUMENTOS_URL}${documentoId}/comentarios/`,
  );
  return data;
}

export async function comentarNoDocumento(
  documentoId: number,
  texto: string,
): Promise<Comentario> {
  const { data } = await api.post<Comentario>(
    `${DOCUMENTOS_URL}${documentoId}/comentarios/`,
    { texto },
  );
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
  return normalizarProcesso(data);
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

// STC-778: renovação em lote (rotas em lotes-renovacao/). Cada operação vale
// para todos os itens do lote ou para nenhum; a resposta é o lote atualizado.
export async function iniciarLote(payload: IniciarLotePayload): Promise<LoteRenovacao> {
  const { data } = await api.post<LoteRenovacao>(LOTES_URL, payload);
  return data;
}

export async function buscarLote(id: number): Promise<LoteRenovacao> {
  const { data } = await api.get<LoteRenovacao>(`${LOTES_URL}${id}/`);
  return data;
}

export async function registrarProtocoloLote(
  id: number,
  payload: ProtocoloLotePayload,
): Promise<LoteRenovacao> {
  const { data } = await api.post<LoteRenovacao>(`${LOTES_URL}${id}/protocolo/`, payload);
  return data;
}

// Comprovante e laudo único: o mesmo envio direto ao R2 da evidência
// (src/lib/uploadDireto.ts); o backend copia o arquivo para cada item.
export async function enviarComprovanteLote(
  id: number,
  arquivo: File,
  aoProgredir?: AoProgredir,
): Promise<LoteRenovacao> {
  return enviarArquivo<LoteRenovacao>(
    `${LOTES_URL}${id}/comprovantes-protocolo/`,
    arquivo,
    aoProgredir,
  );
}

export async function enviarCertificadoUnicoLote(
  id: number,
  arquivo: File,
  aoProgredir?: AoProgredir,
): Promise<LoteRenovacao> {
  return enviarArquivo<LoteRenovacao>(`${LOTES_URL}${id}/certificado/`, arquivo, aoProgredir);
}

export async function concluirLote(
  id: number,
  itens: { processo: number; nova_validade: string }[],
): Promise<LoteRenovacao> {
  const { data } = await api.post<LoteRenovacao>(`${LOTES_URL}${id}/concluir/`, { itens });
  return data;
}

// null: o lote ficou sem itens e saiu (204).
export async function retirarItemLote(
  id: number,
  processo: number,
  manterRenovacao: boolean,
): Promise<LoteRenovacao | null> {
  const resposta = await api.post<LoteRenovacao>(`${LOTES_URL}${id}/retirar/`, {
    processo,
    manter_renovacao: manterRenovacao,
  });
  return resposta.status === 204 ? null : resposta.data;
}

// Embaixo de todo campo de validade (STC-835): um PGR foi cadastrado com a
// data de emissão no lugar da de vencimento e virou Vencido.
export const DICA_VALIDADE = "Data em que o documento vence.";
