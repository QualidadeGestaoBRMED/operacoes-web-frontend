/**
 * Ajuda do Atlas (STC-878): o "como usar", um artigo por tarefa, em
 * `conteudo/ajuda/` (lidos no servidor, `conteudoAjuda.ts`). Aqui ficam as
 * regras que valem no navegador: o que cada pessoa vê, os grupos da página
 * da Ajuda e os artigos de cada tela, para o botão (?).
 */

/** O que o navegador recebe de cada artigo (sem o texto). */
export interface ArtigoResumido {
  /** O nome do arquivo, sem ".md": o endereço /ajuda/<slug>. */
  slug: string;
  titulo: string;
  resumo: string;
  /** Código do módulo; null: geral, em "Primeiros passos". */
  modulo: string | null;
  admin: boolean;
  /** Telas a que o artigo se refere ("/modulos/legalizacao/mapa"). */
  telas: string[];
  /** Posição dentro do grupo (menor primeiro). */
  ordem: number;
}

export const FORMATO_DO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Dentro do grupo: pela ordem e, empatando, pelo título. */
export function ordenarArtigos<T extends ArtigoResumido>(artigos: T[]): T[] {
  return [...artigos].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/** Os que a pessoa vê: dos módulos que acessa (sem módulo: todos) e, os de
 * Administração, só quem administra. Mesma regra das Novidades. */
export function artigosVisiveis<T extends ArtigoResumido>(
  artigos: T[],
  codigosDosModulos: string[],
  administra: boolean,
): T[] {
  return artigos.filter(
    (artigo) =>
      (!artigo.admin || administra) &&
      (artigo.modulo === null || codigosDosModulos.includes(artigo.modulo)),
  );
}

export interface GrupoDaAjuda<T extends ArtigoResumido = ArtigoResumido> {
  /** "primeiros-passos", o código do módulo ou "administracao". */
  chave: string;
  titulo: string;
  artigos: T[];
}

/**
 * Os grupos da página da Ajuda: "Primeiros passos" (os gerais), um por
 * módulo, na ordem do menu, e "Administração" (artigos `admin` sem módulo).
 * Grupo sem artigo não aparece.
 */
export function agruparArtigos<T extends ArtigoResumido>(
  artigos: T[],
  modulos: { codigo: string; nome: string }[],
): GrupoDaAjuda<T>[] {
  const grupos: GrupoDaAjuda<T>[] = [
    {
      chave: "primeiros-passos",
      titulo: "Primeiros passos",
      artigos: artigos.filter((artigo) => artigo.modulo === null && !artigo.admin),
    },
    ...modulos.map((modulo) => ({
      chave: modulo.codigo,
      titulo: modulo.nome,
      artigos: artigos.filter((artigo) => artigo.modulo === modulo.codigo),
    })),
    {
      chave: "administracao",
      titulo: "Administração",
      artigos: artigos.filter((artigo) => artigo.modulo === null && artigo.admin),
    },
  ];
  return grupos
    .map((grupo) => ({ ...grupo, artigos: ordenarArtigos(grupo.artigos) }))
    .filter((grupo) => grupo.artigos.length > 0);
}

function comprimentoDaTela(tela: string, pathname: string): number {
  return pathname === tela || pathname.startsWith(`${tela}/`) ? tela.length : -1;
}

/**
 * Os artigos da tela aberta, para o botão (?): os da tela mais específica.
 * No Mapa ("/modulos/legalizacao/mapa"), um artigo do Mapa ganha de um da
 * Legalização inteira ("/modulos/legalizacao").
 */
export function artigosDaTela<T extends ArtigoResumido>(artigos: T[], pathname: string): T[] {
  const medidos = artigos.map((artigo) => ({
    artigo,
    medida: Math.max(-1, ...artigo.telas.map((tela) => comprimentoDaTela(tela, pathname))),
  }));
  const melhor = Math.max(-1, ...medidos.map(({ medida }) => medida));
  if (melhor < 0) return [];
  return ordenarArtigos(medidos.filter(({ medida }) => medida === melhor).map(({ artigo }) => artigo));
}
