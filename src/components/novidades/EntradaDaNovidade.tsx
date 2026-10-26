"use client";

import Link from "next/link";
import { ArrowRight, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { dataPorExtenso, type NovidadeResumida } from "@/lib/novidades";
import { cn } from "@/lib/utils";

export type NovidadeComTexto = NovidadeResumida & {
  /** Texto em Markdown já montado no servidor. */
  texto: React.ReactNode;
  /** Texto cru, para a busca. */
  busca: string;
};

async function copiarLink(id: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/novidades/${id}`);
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
      <div className="space-y-2 sm:pt-0.5">
        <time dateTime={novidade.data} className="block text-sm font-medium text-foreground">
          {dataPorExtenso(novidade.data)}
        </time>
        {novidade.destaque && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Sparkles className="size-3" aria-hidden />
            Destaque
          </span>
        )}
      </div>

      <article className="max-w-[42.5rem] min-w-0 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            {comLinkNoTitulo ? (
              <Link href={`/novidades/${novidade.id}`} className="hover:underline">
                {novidade.titulo}
              </Link>
            ) : (
              novidade.titulo
            )}
          </h2>
          <button
            type="button"
            onClick={() => void copiarLink(novidade.id)}
            aria-label={`Copiar link de "${novidade.titulo}"`}
            title="Copiar link"
            className="mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Link2 className="size-4" aria-hidden />
          </button>
        </div>
        {novidade.imagem && (
          // GIF ou WebP animado também (tutorial do recurso em uso).
          // eslint-disable-next-line @next/next/no-img-element -- imagem de conteúdo, tamanho livre
          <img
            src={novidade.imagem}
            alt=""
            className="w-full rounded-xl border border-border shadow-sm"
            loading="lazy"
          />
        )}
        <p className="text-base leading-7 text-foreground">{novidade.resumo}</p>
        {novidade.texto && (
          <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">{novidade.texto}</div>
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
      </article>
    </li>
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
