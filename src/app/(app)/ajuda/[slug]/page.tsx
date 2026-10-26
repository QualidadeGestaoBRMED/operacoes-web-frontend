import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDoArtigo } from "@/components/ajuda/PaginaDoArtigo";
import { TextoEmMarkdown } from "@/components/conteudo/TextoEmMarkdown";
import { lerArtigos } from "@/lib/conteudoAjuda";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artigo = lerArtigos().find((outro) => outro.slug === slug);
  return { title: artigo ? `${artigo.titulo} · Ajuda · Atlas` : "Ajuda · Atlas" };
}

/** /ajuda/<assunto>: a página própria de um artigo da Ajuda. */
export default async function ArtigoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const encontrado = lerArtigos().find((artigo) => artigo.slug === slug);
  if (!encontrado) notFound();
  const { corpo, ...artigo } = encontrado;
  return (
    <PaginaDoArtigo
      artigo={artigo}
      texto={<TextoEmMarkdown markdown={corpo} prefixoDasAncoras={artigo.slug} comLinksDasSecoes />}
    />
  );
}
