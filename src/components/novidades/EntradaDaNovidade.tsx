"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavegacao } from "@/hooks/useNavegacao";
import { dataPorExtenso, type NovidadeResumida } from "@/lib/novidades";
import { cn } from "@/lib/utils";

export type NovidadeComTexto = NovidadeResumida & {
  /** Texto em Markdown já montado no servidor. */
  texto: React.ReactNode;
  /** Texto cru, para a busca. */
  busca: string;
};

/**
 * Compartilhar, como o "Share" do Linear: no celular, a folha de
 * compartilhamento do sistema (WhatsApp, e-mail...); no computador, copia o
 * link da página da novidade.
 */
async function compartilhar(novidade: NovidadeResumida) {
  const url = `${window.location.origin}/novidades/${novidade.id}`;
  if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: novidade.titulo, text: novidade.resumo, url });
      return;
    } catch (erro) {
      if ((erro as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link da novidade copiado.");
  } catch {
    toast.error("Não foi possível copiar o link.");
  }
}

/**
 * Uma novidade na linha do tempo (STC-877): a data na coluna da esquerda,
 * com o ponto, e o conteúdo na coluna larga (no celular, a data em cima).
 * Na lista, o título leva à página própria da novidade, como no Linear.
 */
export function EntradaDaNovidade({
  novidade,
  comLinkNoTitulo,
}: {
  novidade: NovidadeComTexto;
  comLinkNoTitulo: boolean;
}) {
  const { modulos } = useNavegacao();
  const categorias = [
    ...novidade.modulos.map(
      (codigo) => modulos.find((modulo) => modulo.codigo === codigo)?.nome ?? codigo,
    ),
    ...(novidade.admin ? ["Administração"] : []),
  ];
  return (
    <li
      id={novidade.id}
      className="relative grid scroll-mt-6 gap-x-10 gap-y-3 pb-16 pl-7 last:pb-4 sm:grid-cols-[11rem_minmax(0,1fr)]"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 left-0 size-2.5 rounded-full ring-4 ring-background",
          novidade.destaque ? "bg-amber-400" : "bg-primary",
        )}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-col sm:items-start sm:pt-0.5">
        <time dateTime={novidade.data} className="block text-sm font-medium text-foreground">
          {dataPorExtenso(novidade.data)}
        </time>
        {(novidade.destaque || categorias.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {novidade.destaque && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <Sparkles className="size-3" aria-hidden />
                Destaque
              </span>
            )}
            {categorias.map((categoria) => (
              <span
                key={categoria}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {categoria}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void compartilhar(novidade)}
          aria-label={`Compartilhar "${novidade.titulo}"`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Share2 className="size-3.5" aria-hidden />
          Compartilhar
        </button>
      </div>

      <article className="max-w-[42.5rem] min-w-0 space-y-5">
        <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {comLinkNoTitulo ? (
            <Link href={`/novidades/${novidade.id}`} className="hover:underline">
              {novidade.titulo}
            </Link>
          ) : (
            novidade.titulo
          )}
        </h2>
        {novidade.imagem && <MidiaDaNovidade src={novidade.imagem} alt={novidade.titulo} />}
        <p className="text-base leading-7 text-foreground">{novidade.resumo}</p>
        {novidade.texto && (
          <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">{novidade.texto}</div>
        )}
        {(novidade.abrir || novidade.ajuda) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            {novidade.abrir && (
              <Button asChild>
                <Link href={novidade.abrir}>
                  Abrir no Atlas
                  <ExternalLink className="size-4" aria-hidden />
                </Link>
              </Button>
            )}
            {novidade.ajuda && (
              <Link
                href={`/ajuda/${novidade.ajuda}`}
                className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
              >
                Ver como usar
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

/**
 * Print ou animação (WebP/GIF) da novidade. As imagens são gravadas em 2x
 * (`srcSet ... 2x`): aparecem na metade dos pixels, nítidas, e nunca são
 * esticadas. Uma tela de celular fica estreita e centralizada sobre um fundo
 * suave; um print de computador ocupa a largura da coluna. `alt` descreve o
 * que a imagem mostra, para leitor de tela.
 */
export function MidiaDaNovidade({
  src,
  alt,
  alturaMaxima = "max-h-[36rem]",
}: {
  src: string;
  alt: string;
  alturaMaxima?: string;
}) {
  return (
    <figure className="flex justify-center rounded-xl bg-muted/60 p-3 sm:p-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem de conteúdo, tamanho livre */}
      <img
        src={src}
        srcSet={`${src} 2x`}
        alt={alt}
        loading="lazy"
        className={cn("block h-auto w-auto max-w-full rounded-lg border border-border shadow-sm", alturaMaxima)}
      />
    </figure>
  );
}

/** A linha do tempo: um traço vertical que liga os pontos de cada data. */
export function LinhaDoTempo({ children }: { children: React.ReactNode }) {
  return (
    <ol className="relative before:absolute before:top-2 before:bottom-0 before:left-[4.5px] before:w-px before:bg-border">
      {children}
    </ol>
  );
}

/** Sem a lista de módulos (falha na busca), não dá para saber o que a pessoa vê. */
export function FalhaNosModulos({ onTentarDeNovo, texto }: { onTentarDeNovo: () => void; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-[15px] text-muted-foreground">{texto}</p>
      <Button variant="outline" onClick={onTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}
