"use client";

import useSWR from "swr";
import { Paperclip } from "lucide-react";
import { AnexoList } from "@/components/demanda/AnexoList";
import {
  BotaoComentarios,
  PainelComentarios,
  PainelSobreposto,
} from "@/components/demanda/PainelComentarios";
import { Button } from "@/components/ui/button";
import { useDemanda } from "@/hooks/useDemandas";
import { fonteDaDemanda } from "@/hooks/useComentarios";
import { listarAnexos, listarComentarios } from "@/lib/demandas";
import { redeDaUnidade } from "@/lib/redes";
import { useVerComo } from "@/lib/verComo";

// Conversa entre o RH (Admin) e a coordenação na demanda do alerta de
// absenteísmo (STC-722) e os anexos dela (STC-850, ex.: a carta de
// advertência): mesmo feed e mesma lista das abas do Kanban, ocupando a
// área de conteúdo do modal.

export interface ConversaAberta {
  demandaId: number;
  /** "Alerta de setembro/2026" */
  titulo: string;
  /** Situação no clique; o painel acompanha a demanda depois disso. */
  aberta: boolean;
  conteudo: "conversa" | "anexos";
}

export const AVISO_DADOS_DE_SAUDE = "Não registre diagnóstico, CID ou outros dados de saúde.";
export const AVISO_ANEXOS = "Não anexe atestado ou documento com informação de saúde.";

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
  return (
    <BotaoComentarios
      rotulo="Conversa"
      rotuloAcessivel="Conversa da demanda"
      quantidade={data?.length}
      onAbrir={onAbrir}
    />
  );
}

/** Botão do card do alerta, com a quantidade de anexos. */
export function BotaoAnexos({
  demandaId,
  onAbrir,
}: {
  demandaId: number;
  onAbrir: (origem: HTMLElement) => void;
}) {
  // Mesma chave da lista (useAnexos), sem o polling dela.
  const { data } = useSWR(["demanda", demandaId, "anexos"], () => listarAnexos(demandaId));
  const quantidade = data?.length;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(evento) => onAbrir(evento.currentTarget)}
      aria-label={
        quantidade === undefined
          ? "Anexos da demanda"
          : `Anexos da demanda, ${quantidade} ${quantidade === 1 ? "anexo" : "anexos"}`
      }
    >
      <Paperclip aria-hidden className="size-3.5" />
      Anexos
      {quantidade !== undefined && (
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {quantidade}
        </span>
      )}
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
  // A demanda pode ser concluída com o painel aberto (tratamento registrado
  // por outra pessoa): a situação vem da própria demanda, com o mesmo polling
  // do Kanban; até a primeira resposta, vale a do clique.
  const { demanda } = useDemanda(conversa.demandaId);
  const verComo = useVerComo();
  const aberta = demanda
    ? demanda.status !== "concluido" && demanda.status !== "lixeira"
    : conversa.aberta;

  if (conversa.conteudo === "anexos") {
    // Anexar continua possível com a demanda concluída: a carta costuma
    // chegar depois de o tratamento ser registrado, e registrar conclui.
    const podeAnexar = demanda ? demanda.status !== "lixeira" && !verComo : false;
    return (
      <PainelSobreposto titulo={`Anexos · ${conversa.titulo}`} onVoltar={onVoltar}>
        <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
          {AVISO_ANEXOS}
        </p>
        <AnexoList
          demandaId={conversa.demandaId}
          podeAnexar={podeAnexar}
          rede={redeDaUnidade(demanda?.unidade)}
        />
      </PainelSobreposto>
    );
  }

  return (
    <PainelComentarios
      titulo={`Conversa · ${conversa.titulo}`}
      fonte={fonteDaDemanda(conversa.demandaId)}
      podeComentar={aberta}
      aviso={AVISO_DADOS_DE_SAUDE}
      somenteLeitura="Demanda concluída: a conversa fica só para leitura."
      onVoltar={onVoltar}
    />
  );
}
