import path from "node:path";
import matter from "gray-matter";
import { caminhoInterno, lerPasta, textoDoCabecalho as texto } from "./arquivosDeConteudo";
import { FORMATO_DO_IDENTIFICADOR, ordenar, type NovidadeResumida } from "./novidades";

/**
 * Leitura dos arquivos de `conteudo/novidades/` (STC-877). Só no servidor:
 * `fs` e o gray-matter não vão para o navegador.
 */

export interface Novidade extends NovidadeResumida {
  /** Texto em Markdown, mostrado só na página de Novidades. */
  corpo: string;
}

export const PASTA_DAS_NOVIDADES = path.join(process.cwd(), "conteudo", "novidades");

/** Uma entrada a partir do arquivo, ou o motivo de não valer. */
export function lerNovidade(arquivo: string, conteudo: string): Novidade | string {
  const id = arquivo.replace(/\.md$/, "");
  if (!FORMATO_DO_IDENTIFICADOR.test(id)) {
    return `nome fora do formato AAAA-MM-DD-NN-assunto.md`;
  }
  const { data, content } = matter(conteudo);
  const titulo = texto(data.titulo);
  const resumo = texto(data.resumo);
  if (!titulo || !resumo) return "sem titulo ou resumo no cabeçalho";
  const modulos = data.modulos ?? [];
  if (!Array.isArray(modulos) || !modulos.every((codigo) => typeof codigo === "string")) {
    return "modulos precisa ser uma lista de códigos";
  }
  return {
    id,
    data: id.slice(0, 10),
    titulo,
    resumo,
    modulos,
    admin: data.admin === true,
    destaque: data.destaque === true,
    imagem: texto(data.imagem),
    ajuda: texto(data.ajuda),
    abrir: caminhoInterno(data.abrir),
    corpo: content.trim(),
  };
}

let emMemoria: Novidade[] | null = null;

/**
 * Todas as entradas válidas, da mais nova para a mais antiga. Em produção,
 * lidas uma vez por processo.
 */
export function lerNovidades(pasta = PASTA_DAS_NOVIDADES): Novidade[] {
  if (emMemoria && pasta === PASTA_DAS_NOVIDADES && process.env.NODE_ENV === "production") {
    return emMemoria;
  }
  const ordenadas = ordenar(lerPasta(pasta, lerNovidade, "Novidade ignorada"));
  if (pasta === PASTA_DAS_NOVIDADES) emMemoria = ordenadas;
  return ordenadas;
}

/** O que vai para o navegador: sem o texto. */
export function resumidas(novidades: Novidade[]): NovidadeResumida[] {
  return novidades.map((novidade) => {
    const resumida: NovidadeResumida & { corpo?: string } = { ...novidade };
    delete resumida.corpo;
    return resumida;
  });
}
