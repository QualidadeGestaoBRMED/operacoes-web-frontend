"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { visiveisPara } from "@/lib/novidades";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import {
  EntradaDaNovidade,
  FalhaNosModulos,
  LinhaDoTempo,
  type NovidadeComTexto,
} from "./EntradaDaNovidade";
import { useNovidades } from "./NovidadesProvider";

/**
 * Página própria de uma novidade (STC-877), com endereço para compartilhar,
 * como no Linear (/novidades/AAAA-MM-DD-NN-assunto). Marca só ela como vista.
 * De um módulo que a pessoa não acessa: avisa, sem mostrar o conteúdo. Sem
 * a lista de módulos (falha na busca), não dá para saber: oferece tentar de
 * novo.
 */
export function PaginaDaNovidade({ novidade }: { novidade: NovidadeComTexto }) {
  const { modulos, temAdministracao } = useNavegacao();
  const {
    isLoading: carregandoModulos,
    error: falhaNosModulos,
    recarregar: recarregarModulos,
  } = useModulos();
  const { visiveis: todasVisiveis, marcarComoVistas } = useNovidades();
  // Da mais nova para a mais antiga: "anterior" é a mais antiga ao lado.
  const posicao = todasVisiveis.findIndex((outra) => outra.id === novidade.id);
  const anterior = posicao >= 0 ? todasVisiveis[posicao + 1] : undefined;
  const proxima = posicao > 0 ? todasVisiveis[posicao - 1] : undefined;
  const visivel =
    visiveisPara([novidade], modulos.map((modulo) => modulo.codigo), temAdministracao).length > 0;

  useEffect(() => {
    void marcarComoVistas(novidade.id);
  }, [marcarComoVistas, novidade.id]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/novidades"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Todas as novidades
      </Link>
      <div className="mt-8">
        {carregandoModulos ? null : falhaNosModulos ? (
          <FalhaNosModulos
            texto="Não foi possível carregar esta novidade."
            onTentarDeNovo={() => void recarregarModulos()}
          />
        ) : visivel ? (
          <LinhaDoTempo>
            <EntradaDaNovidade novidade={novidade} comLinkNoTitulo={false} />
          </LinhaDoTempo>
        ) : (
          <p className="py-16 text-center text-[15px] text-muted-foreground">
            Esta novidade não está disponível para você.
          </p>
        )}
      </div>
      {!falhaNosModulos && visivel && (anterior || proxima) && (
        <nav
          aria-label="Outras novidades"
          className="mt-4 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
        >
          {anterior ? (
            <Link
              href={`/novidades/${anterior.id}`}
              className="group rounded-xl border border-border p-4 transition-colors hover:bg-muted/60"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowLeft className="size-3.5" aria-hidden />
                Novidade anterior
              </span>
              <span className="mt-1 block font-medium text-foreground group-hover:underline">
                {anterior.titulo}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {proxima && (
            <Link
              href={`/novidades/${proxima.id}`}
              className="group rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/60"
            >
              <span className="flex items-center justify-end gap-1.5 text-xs font-medium text-muted-foreground">
                Próxima novidade
                <ArrowRight className="size-3.5" aria-hidden />
              </span>
              <span className="mt-1 block font-medium text-foreground group-hover:underline">
                {proxima.titulo}
              </span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
