import { isAxiosError } from "axios";
import api from "@/lib/api";

// Upload direto ao R2 (STC-628, backend em STC-627, backend/docs/UPLOAD_DIRETO.md).
// O proxy BFF (/api/backend) roda numa função da Vercel, que recusa corpo
// acima de 4,5 MB -- o limite do Atlas é 35 MB. O arquivo vai do navegador
// direto para o bucket, por uma URL assinada que o backend gera; o backend
// só autoriza (preparar) e registra (confirmar), sem receber os bytes.

type PreparacaoEnvio =
  | { modo: "multipart" }
  | {
      modo: "direto";
      url: string;
      metodo: "PUT";
      cabecalhos: Record<string, string>;
      token: string;
    };

/** Falha no envio direto ao bucket, com mensagem pronta para a tela
 * (extrairMensagemErro, src/lib/erros.ts). */
export class ErroEnvioArquivo extends Error {
  /** O navegador nem chegou a uma resposta do bucket: rede, CORS do bucket
   * ou CSP (connect-src) bloqueando. */
  readonly bloqueado: boolean;

  constructor(mensagem: string, bloqueado = false) {
    super(mensagem);
    this.name = "ErroEnvioArquivo";
    this.bloqueado = bloqueado;
  }
}

// Abaixo disto o arquivo cabe no corpo da função da Vercel (4,5 MB), com
// folga para o envelope do multipart.
const LIMITE_ENVIO_PELO_PROXY = 4 * 1024 * 1024;

const MENSAGEM_FALHA_ENVIO =
  "Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.";

export type AoProgredir = (fracao: number) => void;

// XMLHttpRequest, não fetch: o fetch não informa o progresso do envio, e um
// arquivo de 35 MB leva alguns segundos. Fora do Axios de propósito: o
// destino é o R2, não o backend -- sem baseURL, sem Authorization e sem a
// renovação de sessão do interceptor (src/lib/api.ts).
function enviarAoBucket(
  preparacao: Extract<PreparacaoEnvio, { modo: "direto" }>,
  arquivo: File,
  aoProgredir?: AoProgredir,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open(preparacao.metodo, preparacao.url);
    // Content-Type e Content-Disposition fazem parte da assinatura: com
    // outro valor, o R2 recusa. Content-Length (também assinado) o próprio
    // navegador põe, a partir do File.
    for (const [nome, valor] of Object.entries(preparacao.cabecalhos)) {
      requisicao.setRequestHeader(nome, valor);
    }
    if (aoProgredir) {
      requisicao.upload.onprogress = (evento) => {
        if (evento.lengthComputable) aoProgredir(evento.loaded / evento.total);
      };
    }
    requisicao.onload = () => {
      if (requisicao.status >= 200 && requisicao.status < 300) resolve();
      else reject(new ErroEnvioArquivo(MENSAGEM_FALHA_ENVIO));
    };
    // Rede caída, CORS do bucket ou CSP (connect-src, src/lib/csp.ts)
    // bloqueando: o navegador não diz qual, só que falhou.
    requisicao.onerror = () => reject(new ErroEnvioArquivo(MENSAGEM_FALHA_ENVIO, true));
    requisicao.onabort = () => reject(new ErroEnvioArquivo(MENSAGEM_FALHA_ENVIO));
    requisicao.send(arquivo);
  });
}

// Campos que acompanham o arquivo no envio (ex.: a troca do PDF da
// evidência, STC-853): no FormData do multipart e no corpo da confirmação do
// envio direto.
export type CamposDoEnvio = Record<string, string | boolean>;

async function enviarMultipart<T>(
  urlBase: string,
  arquivo: File,
  aoProgredir?: AoProgredir,
  campos: CamposDoEnvio = {},
): Promise<T> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  for (const [nome, valor] of Object.entries(campos)) formData.append(nome, String(valor));
  const { data } = await api.post<T>(urlBase, formData, {
    onUploadProgress: aoProgredir
      ? (evento) => {
          if (evento.total) aoProgredir(evento.loaded / evento.total);
        }
      : undefined,
  });
  return data;
}

async function preparar(urlBase: string, arquivo: File): Promise<PreparacaoEnvio> {
  try {
    const { data } = await api.post<PreparacaoEnvio>(`${urlBase}preparar-envio/`, {
      nome: arquivo.name,
      tamanho: arquivo.size,
    });
    return data;
  } catch (erro) {
    // Backend ainda sem a rota (deploy do frontend antes do backend): o
    // envio multipart de sempre continua funcionando até 4,5 MB.
    if (isAxiosError(erro) && (erro.response?.status === 404 || erro.response?.status === 405)) {
      return { modo: "multipart" };
    }
    throw erro;
  }
}

/**
 * Envia `arquivo` para o destino `urlBase` (ex.: ".../demandas/12/anexos/")
 * e devolve o registro criado pelo backend (Anexo, EvidenciaRegulatoria).
 *
 * Com R2: preparar → PUT direto no bucket → confirmar. Sem R2 (dev, E2E) o
 * backend responde `modo: "multipart"` no preparar, e o arquivo vai pelo
 * POST multipart de `urlBase`, como antes.
 */
export async function enviarArquivo<T>(
  urlBase: string,
  arquivo: File,
  aoProgredir?: AoProgredir,
  campos: CamposDoEnvio = {},
): Promise<T> {
  const preparacao = await preparar(urlBase, arquivo);
  if (preparacao.modo === "multipart") {
    return enviarMultipart<T>(urlBase, arquivo, aoProgredir, campos);
  }
  try {
    await enviarAoBucket(preparacao, arquivo, aoProgredir);
  } catch (erro) {
    // Bucket inalcançável do navegador (NEXT_PUBLIC_R2_URL_BUCKET ausente na Vercel, CORS
    // do bucket não configurado): um arquivo que cabe no proxy segue pelo
    // multipart, como antes do envio direto, em vez de falhar. O aviso no
    // console aponta a configuração que falta.
    if (
      erro instanceof ErroEnvioArquivo &&
      erro.bloqueado &&
      arquivo.size <= LIMITE_ENVIO_PELO_PROXY
    ) {
      console.warn(
        "Envio direto ao R2 bloqueado; enviando pelo proxy. Conferir NEXT_PUBLIC_R2_URL_BUCKET e o CORS do bucket.",
      );
      return enviarMultipart<T>(urlBase, arquivo, aoProgredir, campos);
    }
    throw erro;
  }
  const { data } = await api.post<T>(`${urlBase}confirmar-envio/`, {
    token: preparacao.token,
    ...campos,
  });
  return data;
}
