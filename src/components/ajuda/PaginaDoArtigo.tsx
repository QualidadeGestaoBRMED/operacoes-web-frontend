"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, ExternalLink, Share2 } from "lucide-react";
import { FalhaNosModulos } from "@/components/conteudo/FalhaNosModulos";
import { Button } from "@/components/ui/button";
import { agruparArtigos, type ArtigoResumido } from "@/lib/ajuda";
import { compartilhar } from "@/lib/compartilhar";
import { useAjuda } from "./AjudaProvider";

/**
 * Página própria de um artigo da Ajuda (STC-878), como no Linear: a trilha
 * (Ajuda › módulo), título, resumo, o texto em seções com link próprio e,
 * no fim, o anterior e o próximo do mesmo grupo. De um módulo que a pessoa
 * não acessa: avisa, sem mostrar o conteúdo.
 */
export function PaginaDoArtigo({ artigo, texto }: { artigo: ArtigoResumido; texto: React.ReactNode }) {
  const { visiveis, modulos, carregando, falha, recarregar } = useAjuda();
  const grupo = agruparArtigos(visiveis, modulos).find((outro) =>
    outro.artigos.some((daLista) => daLista.slug === artigo.slug),
  );
  const posicao = grupo ? grupo.artigos.findIndex((daLista) => daLista.slug === artigo.slug) : -1;
  const anterior = grupo && posicao > 0 ? grupo.artigos[posicao - 1] : undefined;
  const proximo = grupo && posicao >= 0 ? grupo.artigos[posicao + 1] : undefined;
  const tela = artigo.telas[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-sm font-medium text-muted-foreground">
        <Link href="/ajuda" className="hover:text-foreground">
          Ajuda
        </Link>
        {grupo && (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/ajuda#grupo-${grupo.chave}`} className="hover:text-foreground">
              {grupo.titulo}
            </Link>
          </>
        )}
      </nav>

      {carregando ? null : falha ? (
        <FalhaNosModulos texto="Não foi possível carregar este artigo." onTentarDeNovo={() => void recarregar()} />
      ) : !grupo ? (
        <p className="py-16 text-center text-[15px] text-muted-foreground">
          Este artigo não está disponível para você.
        </p>
      ) : (
        <>
          <article className="mt-6 space-y-5">
            <div className="space-y-3">
              <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                {artigo.titulo}
              </h2>
              <p className="text-base leading-7 text-muted-foreground">{artigo.resumo}</p>
              <button
                type="button"
                onClick={() =>
                  void compartilhar({
                    titulo: artigo.titulo,
                    texto: artigo.resumo,
                    caminho: `/ajuda/${artigo.slug}`,
                    copiado: "Link do artigo copiado.",
                  })
                }
                aria-label={`Compartilhar "${artigo.titulo}"`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Share2 className="size-3.5" aria-hidden />
                Compartilhar
              </button>
            </div>
            <div className="space-y-4 border-t border-border pt-6 text-[15px] leading-7 text-muted-foreground">
              {texto}
            </div>
            {tela && (
              <div className="pt-2">
                <Button asChild>
                  <Link href={tela}>
                    Abrir no Atlas
                    <ExternalLink className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            )}
          </article>

          {(anterior || proximo) && (
            <nav
              aria-label="Outros artigos"
              className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
            >
              {anterior ? (
                <Link
                  href={`/ajuda/${anterior.slug}`}
                  className="group rounded-xl border border-border p-4 transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Anterior
                  </span>
                  <span className="mt-1 block font-medium text-foreground group-hover:underline">
                    {anterior.titulo}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {proximo && (
                <Link
                  href={`/ajuda/${proximo.slug}`}
                  className="group rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-center justify-end gap-1.5 text-xs font-medium text-muted-foreground">
                    Próximo
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                  <span className="mt-1 block font-medium text-foreground group-hover:underline">
                    {proximo.titulo}
                  </span>
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
