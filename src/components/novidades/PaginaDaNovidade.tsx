"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { visiveisPara } from "@/lib/novidades";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import { EntradaDaNovidade, LinhaDoTempo, type NovidadeComTexto } from "./EntradaDaNovidade";
import { useNovidades } from "./NovidadesProvider";

/**
 * Página própria de uma novidade (STC-877), com endereço para compartilhar,
 * como no Linear (/novidades/AAAA-MM-DD-NN-assunto). Marca só ela como vista.
 * De um módulo que a pessoa não acessa: avisa, sem mostrar o conteúdo.
 */
export function PaginaDaNovidade({ novidade }: { novidade: NovidadeComTexto }) {
  const { modulos, temAdministracao } = useNavegacao();
  const { isLoading: carregandoModulos } = useModulos();
  const { marcarComoVistas } = useNovidades();
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
        {carregandoModulos ? null : visivel ? (
          <LinhaDoTempo>
            <EntradaDaNovidade novidade={novidade} comLinkNoTitulo={false} />
          </LinhaDoTempo>
        ) : (
          <p className="py-16 text-center text-[15px] text-muted-foreground">
            Esta novidade não está disponível para você.
          </p>
        )}
      </div>
    </div>
  );
}
