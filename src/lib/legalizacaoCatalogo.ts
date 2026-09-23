import api from "./api";
import type {
  HistoricoTipoDocumento,
  RegraDocumento,
  RegraDocumentoPayload,
  TipoDocumentoRegulatorio,
  TipoDocumentoRegulatorioPayload,
} from "@/types/legalizacao";

const MODULO_URL = "/modulos/legalizacao/";
const TIPOS_DOCUMENTO_URL = `${MODULO_URL}tipos-documento/`;
const REGRAS_URL = `${MODULO_URL}regras/`;

export async function listarTiposDocumento(): Promise<
  TipoDocumentoRegulatorio[]
> {
  const { data } =
    await api.get<TipoDocumentoRegulatorio[]>(TIPOS_DOCUMENTO_URL);
  return data;
}

export async function criarTipoDocumento(
  payload: TipoDocumentoRegulatorioPayload,
): Promise<TipoDocumentoRegulatorio> {
  const { data } = await api.post<TipoDocumentoRegulatorio>(
    TIPOS_DOCUMENTO_URL,
    payload,
  );
  return data;
}

// Usado hoje só pra alternar `ativo` direto na tabela (mesmo padrão de
// atualizarUsuario em plataforma.ts) -- aceita qualquer subconjunto de campos
// porque é PATCH, não PUT.
export async function atualizarTipoDocumento(
  id: number,
  payload: Partial<TipoDocumentoRegulatorioPayload>,
): Promise<TipoDocumentoRegulatorio> {
  const { data } = await api.patch<TipoDocumentoRegulatorio>(
    `${TIPOS_DOCUMENTO_URL}${id}/`,
    payload,
  );
  return data;
}

// STC-500 (backend): histórico de auditoria de edição do catálogo, tabela
// dedicada (não HistoricoRegulatorio, que é FK de DocumentoUnidade).
export async function listarHistoricoTipoDocumento(
  id: number,
): Promise<HistoricoTipoDocumento[]> {
  const { data } = await api.get<HistoricoTipoDocumento[]>(
    `${TIPOS_DOCUMENTO_URL}${id}/historico/`,
  );
  return data;
}

// STC-527: filtro já existia no backend (RegraDocumentoViewSet.
// filterset_fields), sem consumidor no frontend até esta issue -- usado
// pra detectar/reaproveitar uma regra já existente (órfã ou não) antes de
// tentar criar outra igual, ver FormCadastrarDocumento.tsx.
//
// Sem filtro por `ativa` de propósito (achado em análise própria de falhas
// críticas): a UniqueConstraint (tipo_documento, unidade, vigente_a_partir)
// do backend não olha pra esse campo -- uma regra órfã desativada (ex.:
// alguém tentou "limpar" o lixo via Django Admin marcando ativa=False em
// vez de excluir) ainda colidiria na criação e reproduziria o mesmo erro
// técnico que esta issue existe pra resolver. RegraDocumento.regra_efetiva()
// (models.py) confirma que reaproveitar uma regra inativa aqui é seguro:
// regra_aplicada é usado incondicionalmente pela varredura diária, o
// filtro `ativa=True` só entra no fallback quando o campo está vazio.
export async function listarRegras(filtros: {
  tipo_documento: number;
  unidade: number;
}): Promise<RegraDocumento[]> {
  const { data } = await api.get<RegraDocumento[]>(REGRAS_URL, {
    params: filtros,
  });
  return data;
}

// RegraDocumento é append-only depois do primeiro alerta gerado (ver
// legalizacao/models.py::RegraDocumento.save() no backend) -- só existe
// criação aqui, nunca update. "Nova versão" (corrigir uma regra existente) é
// sempre uma nova chamada a esta mesma função, nunca um PATCH.
export async function criarRegraDocumento(
  payload: RegraDocumentoPayload,
): Promise<RegraDocumento> {
  const { data } = await api.post<RegraDocumento>(REGRAS_URL, payload);
  return data;
}

// Usado só como rollback best-effort: quando a regra é criada com sucesso
// mas o passo seguinte (criar/atualizar o documento com ela) falha, evita
// deixar uma versão órfã no catálogo -- ver FormCadastrarDocumento.tsx e
// FormNovaVersaoRegra.tsx. Só funciona enquanto a regra ainda não foi
// vinculada a nenhum documento nem usada por nenhum alerta (exatamente o
// caso de quem acabou de criá-la e falhou no passo seguinte).
export async function excluirRegraDocumento(id: number): Promise<void> {
  await api.delete(`${REGRAS_URL}${id}/`);
}
