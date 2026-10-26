"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { dataPorExtenso, visiveisPara, type NovidadeResumida } from "@/lib/novidades";
import { useNavegacao } from "@/hooks/useNavegacao";
import { useNovidades } from "./NovidadesProvider";

type NovidadeComTexto = NovidadeResumida & { texto: React.ReactNode };

/**
 * Página de Novidades (STC-877): da mais nova para a mais antiga, só as que
 * a pessoa vê. Abrir a página marca a mais nova como vista (some o ponto).
 */
export function ListaDeNovidades({ novidades }: { novidades: NovidadeComTexto[] }) {
  const { modulos, temAdministracao } = useNavegacao();
  const { marcarComoVistas } = useNovidades();
  const visiveis = visiveisPara(
    novidades,
    modulos.map((modulo) => modulo.codigo),
    temAdministracao,
  );

  useEffect(() => {
    void marcarComoVistas();
  }, [marcarComoVistas]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-7">
      <p className="text-sm text-muted-foreground">
        O que mudou no Atlas, da novidade mais recente para a mais antiga.
      </p>
      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma novidade por enquanto.
        </p>
      ) : (
        <ol className="space-y-6">
          {visiveis.map((novidade) => (
            <li key={novidade.id} id={novidade.id} className="scroll-mt-4">
              <article className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <header className="space-y-1">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <time dateTime={novidade.data}>{dataPorExtenso(novidade.data)}</time>
                    {novidade.destaque && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        <Sparkles className="size-3" aria-hidden />
                        Destaque
                      </span>
                    )}
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">{novidade.titulo}</h2>
                </header>
                {novidade.imagem && (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem de conteúdo, tamanho livre
                  <img
                    src={novidade.imagem}
                    alt=""
                    className="w-full rounded-lg border border-border"
                    loading="lazy"
                  />
                )}
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="leading-relaxed text-foreground">{novidade.resumo}</p>
                  {novidade.texto}
                </div>
                {novidade.ajuda && (
                  <Link
                    href={`/ajuda/${novidade.ajuda}`}
                    className="inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Ver como usar →
                  </Link>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
