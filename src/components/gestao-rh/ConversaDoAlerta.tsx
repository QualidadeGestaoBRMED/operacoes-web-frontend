"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { ComentarioFeed } from "@/components/demanda/ComentarioFeed";
import { Button } from "@/components/ui/button";
import { listarComentarios } from "@/lib/demandas";

// Conversa entre o RH (Admin) e a coordenação na demanda do alerta de
// absenteísmo (STC-722): mesmo feed e mesmo visual da aba Comentários do
// Kanban, ocupando a área de conteúdo do modal.

export interface ConversaAberta {
  demandaId: number;
  /** "Alerta de setembro/2026" */
  titulo: string;
  /** Demanda concluída: só leitura. */
  aberta: boolean;
}

export const AVISO_DADOS_DE_SAUDE = "Não registre diagnóstico, CID ou outros dados de saúde.";

/** Botão do card do alerta, com a quantidade de comentários. */
export function BotaoConversa({
  demandaId,
  onAbrir,
}: {
  demandaId: number;
  onAbrir: (origem: HTMLElement) => void;
}) {
  // Mesma chave do feed (useComentarios), sem o polling dele: a contagem só
  // precisa estar certa ao abrir a aba e quando o feed atualiza o cache.
  const { data } = useSWR(["demanda", demandaId, "comentarios"], () =>
    listarComentarios(demandaId),
  );
  const quantidade = data?.length ?? 0;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(evento) => onAbrir(evento.currentTarget)}
      aria-label={`Conversa da demanda, ${quantidade} ${quantidade === 1 ? "comentário" : "comentários"}`}
    >
      <MessageSquare aria-hidden className="size-3.5" />
      Conversa
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
        {quantidade}
      </span>
    </Button>
  );
}

/** Painel sobre a área de conteúdo do modal; "Voltar" devolve à aba como estava. */
export function PainelConversa({
  conversa,
  onVoltar,
}: {
  conversa: ConversaAberta;
  onVoltar: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="conversa-do-alerta-titulo"
      className="absolute inset-0 z-10 flex flex-col bg-background"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button type="button" variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft aria-hidden className="size-3.5" />
          Voltar
        </Button>
        <h3
          ref={titulo}
          id="conversa-do-alerta-titulo"
          tabIndex={-1}
          className="min-w-0 truncate text-[13.5px] font-semibold text-foreground outline-none"
        >
          Conversa · {conversa.titulo}
        </h3>
      </div>
      <ComentarioFeed
        demandaId={conversa.demandaId}
        podeComentar={conversa.aberta}
        aviso={AVISO_DADOS_DE_SAUDE}
      />
      {!conversa.aberta && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Demanda concluída: a conversa fica só para leitura.
        </p>
      )}
    </section>
  );
}
