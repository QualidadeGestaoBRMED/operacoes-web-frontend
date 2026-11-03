import { isAxiosError } from "axios";
import api from "./api";

/** Arquivo baixado da API, com o nome que o backend deu. */
export interface ArquivoBaixado {
  arquivo: Blob;
  nome: string;
}

function nomeDoArquivo(disposicao: unknown, nomeSemCabecalho: string): string {
  const nome = typeof disposicao === "string" ? /filename="([^"]+)"/.exec(disposicao)?.[1] : undefined;
  return nome ?? nomeSemCabecalho;
}

/** Erro em JSON lido do Blob, para extrairMensagemErro mostrar o motivo. */
async function comErroLegivel(erro: unknown): Promise<never> {
  if (isAxiosError(erro) && erro.response?.data instanceof Blob) {
    try {
      erro.response.data = JSON.parse(await erro.response.data.text());
    } catch {
      erro.response.data = undefined;
    }
  }
  throw erro;
}

/**
 * Busca um arquivo de uma rota da API (planilha, PDF) pelo proxy, com o nome
 * do `Content-Disposition` (o proxy o repassa, STC-963). `nomeSemCabecalho`
 * vale quando a resposta não traz nome. Erro do backend chega legível para
 * extrairMensagemErro, mesmo vindo como Blob.
 */
export async function buscarArquivo(
  url: string,
  params: Record<string, unknown>,
  nomeSemCabecalho: string,
): Promise<ArquivoBaixado> {
  try {
    const resposta = await api.get<Blob>(url, { params, responseType: "blob" });
    return {
      arquivo: resposta.data,
      nome: nomeDoArquivo(resposta.headers["content-disposition"], nomeSemCabecalho),
    };
  } catch (erro) {
    return comErroLegivel(erro);
  }
}

const ESPERA_PARA_REVOGAR_MS = 10_000;

/** Faz o navegador salvar o arquivo. */
export function baixarArquivo({ arquivo, nome }: ArquivoBaixado): void {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores (Firefox,
  // Safari): o arquivo ainda não começou a ser lido quando o clique volta.
  setTimeout(() => URL.revokeObjectURL(url), ESPERA_PARA_REVOGAR_MS);
}
