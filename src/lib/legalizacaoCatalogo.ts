import api from "./api";
import type {
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
