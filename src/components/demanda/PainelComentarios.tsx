"use client";

import { useEffect, useId, useRef } from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FonteComentarios } from "@/hooks/useComentarios";
import { ComentarioFeed } from "./ComentarioFeed";

// Comentários de uma demanda abertos a partir de outro módulo: a conversa do
// alerta no Gestão RH (STC-722) e os comentários da renovação na Legalização
// (STC-774). Mesmo feed e mesmo visual da aba Comentários do Kanban.

/** Botão que abre o painel, com a quantidade de comentários. Sem
 * `quantidade` (carregando ou falhou), sem número: "0" faria uma conversa
 * existente parecer vazia. */
export function BotaoComentarios({
  rotulo,
  rotuloAcessivel = rotulo,
  quantidade,
  onAbrir,
  className,
}: {
  /** Texto do botão: "Conversa", "Comentários". */
  rotulo: string;
  /** Nome para leitor de tela, quando o texto curto não basta. */
  rotuloAcessivel?: string;
  quantidade?: number;
  onAbrir: (origem: HTMLElement) => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={(evento) => onAbrir(evento.currentTarget)}
      aria-label={
        quantidade === undefined
          ? rotuloAcessivel
          : `${rotuloAcessivel}, ${quantidade} ${quantidade === 1 ? "comentário" : "comentários"}`
      }
    >
      <MessageSquare aria-hidden className="size-3.5" />
      {rotulo}
      {quantidade !== undefined && (
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {quantidade}
        </span>
      )}
    </Button>
  );
}

/** Painel sobre a área de conteúdo de um modal (o pai precisa ser
 * `relative`); "Voltar" devolve ao conteúdo como estava. */
export function PainelComentarios({
  titulo,
  fonte,
  podeComentar,
  aviso,
  somenteLeitura,
  onVoltar,
  children,
}: {
  titulo: string;
  fonte: FonteComentarios;
  podeComentar: boolean;
  /** Texto fixo acima do campo de envio. */
  aviso?: string;
  /** Rodapé quando não dá para comentar (ex.: demanda concluída). */
  somenteLeitura?: string;
  onVoltar: () => void;
  /** Entre o cabeçalho e o feed (ex.: escolha da renovação). */
  children?: React.ReactNode;
}) {
  const idTitulo = useId();
  const refTitulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    refTitulo.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={idTitulo}
      className="absolute inset-0 z-10 flex flex-col bg-background"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button type="button" variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft aria-hidden className="size-3.5" />
          Voltar
        </Button>
        <h3
          ref={refTitulo}
          id={idTitulo}
          tabIndex={-1}
          className="min-w-0 truncate text-[13.5px] font-semibold text-foreground outline-none"
        >
          {titulo}
        </h3>
      </div>
      {children}
      {/* key: outra fonte (ex.: outra renovação escolhida) começa com o
          campo de envio vazio, sem levar o texto digitado na anterior. */}
      <ComentarioFeed
        key={fonte.chave.join("/")}
        fonte={fonte}
        podeComentar={podeComentar}
        aviso={aviso}
      />
      {!podeComentar && somenteLeitura && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {somenteLeitura}
        </p>
      )}
    </section>
  );
}
