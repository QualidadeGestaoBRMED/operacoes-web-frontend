import path from "node:path";
import matter from "gray-matter";
import { FORMATO_DO_SLUG, ordenarArtigos, type ArtigoResumido } from "./ajuda";
import { caminhoInterno, lerPasta, textoDoCabecalho as texto } from "./arquivosDeConteudo";

/**
 * Leitura dos artigos de `conteudo/ajuda/` (STC-878). Só no servidor: `fs`
 * e o gray-matter não vão para o navegador.
 */

export interface Artigo extends ArtigoResumido {
  /** Texto em Markdown, montado na página e no painel do (?). */
  corpo: string;
}

export const PASTA_DA_AJUDA = path.join(process.cwd(), "conteudo", "ajuda");

/** Um artigo a partir do arquivo, ou o motivo de não valer. */
export function lerArtigo(arquivo: string, conteudo: string): Artigo | string {
  const slug = arquivo.replace(/\.md$/, "");
  if (!FORMATO_DO_SLUG.test(slug)) return "nome fora do formato assunto-em-minusculas.md";
  const { data, content } = matter(conteudo);
  const titulo = texto(data.titulo);
  const resumo = texto(data.resumo);
  if (!titulo || !resumo) return "sem titulo ou resumo no cabeçalho";
  if (data.modulo !== undefined && data.modulo !== null && !texto(data.modulo)) {
    return "modulo precisa ser o código de um módulo";
  }
  const telas = data.telas ?? [];
  if (!Array.isArray(telas) || !telas.every((tela) => caminhoInterno(tela))) {
    return "telas precisa ser uma lista de caminhos do Atlas";
  }
  if (data.ordem !== undefined && !Number.isFinite(data.ordem)) return "ordem precisa ser um número";
  return {
    slug,
    titulo,
    resumo,
    modulo: texto(data.modulo),
    admin: data.admin === true,
    telas: telas.map((tela: string) => tela.trim()),
    ordem: data.ordem ?? 100,
    corpo: content.trim(),
  };
}

let emMemoria: Artigo[] | null = null;

/** Todos os artigos válidos, em ordem. Em produção, lidos uma vez por processo. */
export function lerArtigos(pasta = PASTA_DA_AJUDA): Artigo[] {
  if (emMemoria && pasta === PASTA_DA_AJUDA && process.env.NODE_ENV === "production") {
    return emMemoria;
  }
  const ordenados = ordenarArtigos(lerPasta(pasta, lerArtigo, "Artigo da Ajuda ignorado"));
  if (pasta === PASTA_DA_AJUDA) emMemoria = ordenados;
  return ordenados;
}

/** O que vai para o navegador: sem o texto. */
export function artigosResumidos(artigos: Artigo[]): ArtigoResumido[] {
  return artigos.map((artigo) => {
    const resumido: ArtigoResumido & { corpo?: string } = { ...artigo };
    delete resumido.corpo;
    return resumido;
  });
}
