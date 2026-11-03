import { isAxiosError } from "axios";
import api from "./api";
import type { Rede } from "@/types";
import type { CategoriaDocumento } from "@/types/legalizacao";

const EXPORTAR_URL = "/modulos/legalizacao/documentos/exportar/";

/** Linhas da planilha (STC-962): `recorte` da rota de exportação. */
export type RecorteExportacao = "todos" | "nao_cadastrados" | "cadastrados";

export const RECORTES_EXPORTACAO: { valor: RecorteExportacao; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "nao_cadastrados", rotulo: "Só os não cadastrados" },
  { valor: "cadastrados", rotulo: "Só os cadastrados" },
];

/** Colunas opcionais da planilha, na ordem em que entram nela. */
export type ColunaExportacao =
  | "dias_para_vencer"
  | "responsavel"
  | "area_responsavel"
  | "renovacao"
  | "rede"
  | "setor_apoio"
  | "antecedencia"
  | "justificativa"
  | "ultima_atualizacao"
  | "link";

export const COLUNAS_EXPORTACAO: { valor: ColunaExportacao; rotulo: string }[] = [
  { valor: "dias_para_vencer", rotulo: "Dias para vencer" },
  { valor: "responsavel", rotulo: "Responsável operacional" },
  { valor: "area_responsavel", rotulo: "Área responsável" },
  { valor: "renovacao", rotulo: "Renovação" },
  { valor: "rede", rotulo: "Rede" },
  { valor: "setor_apoio", rotulo: "Setor de apoio" },
  { valor: "antecedencia", rotulo: "Antecedência do alerta" },
  { valor: "justificativa", rotulo: "Justificativa" },
  { valor: "ultima_atualizacao", rotulo: "Última atualização" },
  { valor: "link", rotulo: "Link no Atlas" },
];

export const COLUNAS_PADRAO: ColunaExportacao[] = [
  "dias_para_vencer",
  "responsavel",
  "area_responsavel",
  "renovacao",
];

export interface PedidoExportacao {
  recorte: RecorteExportacao;
  /** Vazio: todas as unidades que a pessoa vê. */
  unidades: number[];
  /** Vazio: todas as categorias. */
  categorias: CategoriaDocumento[];
  colunas: ColunaExportacao[];
  rede?: Rede;
}

export interface ArquivoExportado {
  arquivo: Blob;
  nome: string;
}

function nomeDoArquivo(disposicao: unknown): string {
  const nome = typeof disposicao === "string" ? /filename="([^"]+)"/.exec(disposicao)?.[1] : undefined;
  return nome ?? "situacao-legalizacao.xlsx";
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

/** A planilha da situação da Legalização (STC-962), com o nome do backend. */
export async function exportarSituacao(pedido: PedidoExportacao): Promise<ArquivoExportado> {
  try {
    const resposta = await api.get<Blob>(EXPORTAR_URL, {
      params: {
        recorte: pedido.recorte,
        unidade: pedido.unidades.length ? pedido.unidades.join(",") : undefined,
        categoria: pedido.categorias.length ? pedido.categorias.join(",") : undefined,
        colunas: pedido.colunas.length ? pedido.colunas.join(",") : undefined,
        rede: pedido.rede,
      },
      responseType: "blob",
    });
    return { arquivo: resposta.data, nome: nomeDoArquivo(resposta.headers["content-disposition"]) };
  } catch (erro) {
    return comErroLegivel(erro);
  }
}

const ESPERA_PARA_REVOGAR_MS = 10_000;

/** Faz o navegador salvar o arquivo. */
export function baixarArquivo({ arquivo, nome }: ArquivoExportado): void {
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

const CHAVE_COLUNAS = "atlas.legalizacao.exportacao.colunas";

/** Última escolha de colunas desta pessoa; sem nenhuma, as do padrão. */
export function colunasLembradas(usuarioId: number | undefined): ColunaExportacao[] {
  try {
    const guardado = window.localStorage.getItem(`${CHAVE_COLUNAS}.${usuarioId}`);
    if (!guardado) return COLUNAS_PADRAO;
    const validas = new Set(COLUNAS_EXPORTACAO.map((coluna) => coluna.valor));
    const lidas: unknown = JSON.parse(guardado);
    return Array.isArray(lidas)
      ? lidas.filter((valor): valor is ColunaExportacao => validas.has(valor))
      : COLUNAS_PADRAO;
  } catch {
    return COLUNAS_PADRAO;
  }
}

export function lembrarColunas(usuarioId: number | undefined, colunas: ColunaExportacao[]): void {
  try {
    window.localStorage.setItem(`${CHAVE_COLUNAS}.${usuarioId}`, JSON.stringify(colunas));
  } catch {
    // Sem armazenamento (aba anônima, bloqueado): a escolha vale só agora.
  }
}
