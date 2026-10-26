"use server";

import { TextoEmMarkdown } from "@/components/conteudo/TextoEmMarkdown";
import { lerArtigos } from "@/lib/conteudoAjuda";

/**
 * O texto de um artigo da Ajuda, montado no servidor, para o painel do
 * botão (?) (STC-878): o leitor de Markdown não vai para o navegador.
 */
export async function textoDoArtigo(slug: string) {
  const artigo = lerArtigos().find((outro) => outro.slug === slug);
  if (!artigo) return null;
  return <TextoEmMarkdown markdown={artigo.corpo} prefixoDasAncoras={`painel-${artigo.slug}`} />;
}
