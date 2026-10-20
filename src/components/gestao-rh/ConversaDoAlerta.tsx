"use client";

import useSWR from "swr";
import { BotaoComentarios, PainelComentarios } from "@/components/demanda/PainelComentarios";
import { useDemanda } from "@/hooks/useDemandas";
import { fonteDaDemanda } from "@/hooks/useComentarios";
import { listarComentarios } from "@/lib/demandas";

// Conversa entre o RH (Admin) e a coordenação na demanda do alerta de
// absenteísmo (STC-722): mesmo feed e mesmo visual da aba Comentários do
// Kanban, ocupando a área de conteúdo do modal.

export interface ConversaAberta {
  demandaId: number;
  /** "Alerta de setembro/2026" */
  titulo: string;
  /** Situação no clique; o painel acompanha a demanda depois disso. */
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
  return (
    <BotaoComentarios
      rotulo="Conversa"
      rotuloAcessivel="Conversa da demanda"
      quantidade={data?.length}
      onAbrir={onAbrir}
    />
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
  const aberta = demanda
    ? demanda.status !== "concluido" && demanda.status !== "lixeira"
    : conversa.aberta;

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
