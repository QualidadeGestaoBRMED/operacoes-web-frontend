"use client";

import { useState } from "react";
import { PainelComentarios } from "@/components/demanda/PainelComentarios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFonteDaRenovacao } from "@/hooks/useProcessoRenovacao";
import type { DocumentoUnidade, ProcessoRenovacao } from "@/types/legalizacao";
import { formatarDataDeDatetime, LABEL_STATUS_PROCESSO } from "@/lib/legalizacaoRenovacao";

// Comentários da renovação (STC-774): a conversa do card espelho de cada
// processo no Kanban, lida e escrita pela Legalização (STC-773). Renovação
// concluída fica só para leitura; processo sem card não tem comentários.

/** "Renovação de 15/09/2026 a 10/10/2026 · Concluído" */
export function rotuloDaRenovacao(processo: ProcessoRenovacao) {
  const inicio = formatarDataDeDatetime(processo.created_at);
  const fim = processo.data_conclusao
    ? ` a ${processo.data_conclusao.split("-").reverse().join("/")}`
    : "";
  return `Renovação de ${inicio}${fim} · ${LABEL_STATUS_PROCESSO[processo.status]}`;
}

/** Processos com card, na ordem da lista (mais recente primeiro). */
export function processosComComentarios(processos: ProcessoRenovacao[]) {
  return processos.filter((processo) => processo.card_kanban !== null);
}

/** Painel sobre o conteúdo do modal (o pai precisa ser `relative`), com a
 * escolha da renovação quando o documento tem mais de uma com card. */
export function PainelComentariosDaRenovacao({
  documento,
  processos,
  processoInicialId,
  onVoltar,
}: {
  documento: DocumentoUnidade;
  /** Só os com card (processosComComentarios); pelo menos um. */
  processos: ProcessoRenovacao[];
  processoInicialId: number;
  onVoltar: () => void;
}) {
  const [selecionadoId, setSelecionadoId] = useState(processoInicialId);
  const selecionado =
    processos.find((processo) => processo.id === selecionadoId) ?? processos[0];
  const fonte = useFonteDaRenovacao(selecionado.id, documento.id);

  return (
    <PainelComentarios
      titulo={`Comentários · ${documento.tipo_documento.nome}`}
      fonte={fonte}
      podeComentar={selecionado.status !== "concluido"}
      somenteLeitura="Renovação concluída: os comentários ficam só para leitura."
      onVoltar={onVoltar}
    >
      {processos.length > 1 ? (
        <div className="border-b border-border px-5 py-2.5">
          <Select
            value={String(selecionado.id)}
            onValueChange={(valor) => setSelecionadoId(Number(valor))}
          >
            <SelectTrigger size="sm" className="h-8 w-full" aria-label="Renovação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {processos.map((processo) => (
                <SelectItem key={processo.id} value={String(processo.id)}>
                  {rotuloDaRenovacao(processo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="border-b border-border px-5 py-2.5 text-[12px] text-muted-foreground">
          {rotuloDaRenovacao(selecionado)}
        </p>
      )}
    </PainelComentarios>
  );
}
