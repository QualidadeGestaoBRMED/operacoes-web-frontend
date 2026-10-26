"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { textoDoArtigo } from "@/app/(app)/ajuda/textoDoArtigo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { ArtigoResumido } from "@/lib/ajuda";

type Texto = { estado: "carregando" } | { estado: "pronto"; texto: React.ReactNode } | { estado: "falha" };

/**
 * Painel do botão (?) (STC-878): o artigo da tela aberta, inteiro, sem sair
 * dela. Com mais de um artigo na tela, primeiro a lista. O texto vem do
 * servidor só quando o artigo é aberto.
 */
export function PainelDeAjuda({
  artigos,
  nomeDoModulo,
  aberto,
  onOpenChange,
}: {
  artigos: ArtigoResumido[];
  nomeDoModulo: string | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const artigo = artigos.length === 1 ? artigos[0] : artigos.find((outro) => outro.slug === escolhido);
  const [textos, setTextos] = useState<Record<string, Texto>>({});
  const pedidos = useRef(new Set<string>());

  function carregar(slug: string) {
    pedidos.current.add(slug);
    setTextos((atuais) => ({ ...atuais, [slug]: { estado: "carregando" } }));
    textoDoArtigo(slug).then(
      (texto) =>
        setTextos((atuais) => ({
          ...atuais,
          [slug]: texto ? { estado: "pronto", texto } : { estado: "falha" },
        })),
      () => {
        pedidos.current.delete(slug);
        setTextos((atuais) => ({ ...atuais, [slug]: { estado: "falha" } }));
      },
    );
  }

  useEffect(() => {
    if (aberto && artigo && !pedidos.current.has(artigo.slug)) carregar(artigo.slug);
  }, [aberto, artigo]);

  const texto = artigo ? (textos[artigo.slug] ?? { estado: "carregando" }) : null;
  const rotulo = nomeDoModulo ? `Ajuda · ${nomeDoModulo}` : "Ajuda";

  return (
    <Sheet
      open={aberto}
      onOpenChange={(abrir) => {
        onOpenChange(abrir);
        if (!abrir) setEscolhido(null);
      }}
    >
      <SheetContent>
        <header className="space-y-1.5 border-b border-border px-6 pt-6 pb-4 pr-12">
          {artigo && artigos.length > 1 ? (
            <button
              type="button"
              onClick={() => setEscolhido(null)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Outros artigos desta tela
            </button>
          ) : (
            <p className="text-xs font-medium text-primary">{rotulo}</p>
          )}
          <SheetTitle>{artigo ? artigo.titulo : "Ajuda desta tela"}</SheetTitle>
          <SheetDescription>{artigo ? artigo.resumo : "Escolha um artigo."}</SheetDescription>
        </header>

        <div className="scrollbar-discreta min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!artigo ? (
            <ul className="space-y-2">
              {artigos.map((outro) => (
                <li key={outro.slug}>
                  <button
                    type="button"
                    onClick={() => setEscolhido(outro.slug)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{outro.titulo}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{outro.resumo}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : texto?.estado === "pronto" ? (
            <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">{texto.texto}</div>
          ) : texto?.estado === "falha" ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-[15px] text-muted-foreground">Não foi possível carregar este artigo.</p>
              <Button variant="outline" onClick={() => carregar(artigo.slug)}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <div role="status" aria-label="Carregando o artigo" className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          {artigo ? (
            <Link
              href={`/ajuda/${artigo.slug}`}
              onClick={() => onOpenChange(false)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Abrir em página própria
            </Link>
          ) : (
            <span />
          )}
          <Link
            href="/ajuda"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ver tudo na Ajuda
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
