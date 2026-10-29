"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Demanda, StatusDemanda } from "@/types";
import { DemandaCard } from "./DemandaCard";

interface KanbanColumnProps {
  status: StatusDemanda;
  titulo: string;
  demandas: Demanda[];
  /** Número no cabeçalho: o total da fase, não só os cards carregados. */
  total: number;
  /** A fase tem mais cards do que os carregados (STC-931). */
  temMais?: boolean;
  carregandoMais?: boolean;
  onCarregarMais?: () => void;
  /** A primeira página da fase falhou: a coluna mostra o erro, o quadro segue.
   * Se a coluna já tinha cards (falhou uma atualização), eles continuam. */
  erro?: string | null;
  /** Falhou a página seguinte: os cards já carregados continuam. */
  erroAoCarregarMais?: string | null;
  onTentarDeNovo?: () => void;
  onSelecionarDemanda: (demanda: Demanda) => void;
  onRestaurar: (demanda: Demanda) => void;
}

export function KanbanColumn({
  status,
  titulo,
  demandas,
  total,
  temMais = false,
  carregandoMais = false,
  onCarregarMais,
  erro = null,
  erroAoCarregarMais = null,
  onTentarDeNovo,
  onSelecionarDemanda,
  onRestaurar,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const listaRef = useRef<HTMLDivElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  // Rolagem infinita (STC-931): quando o fim da coluna aparece, pede a
  // página seguinte da fase. Também cobre a coluna curta, que nem chega a
  // ter rolagem (ex.: o foco dos cartões do topo deixou poucos cards à
  // mostra): o fim já aparece de cara e as páginas seguintes vêm até a fase
  // acabar.
  useEffect(() => {
    const fim = fimRef.current;
    if (!temMais || carregandoMais || erroAoCarregarMais || !fim || !onCarregarMais) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) onCarregarMais();
      },
      { root: listaRef.current, rootMargin: "120px" },
    );
    observador.observe(fim);
    return () => observador.disconnect();
  }, [temMais, carregandoMais, erroAoCarregarMais, onCarregarMais, demandas.length]);

  return (
    <div
      ref={setNodeRef}
      // useDroppable({ id: status }) não expõe esse id no DOM -- sem
      // data-testid não existe nenhum seletor estável pra "a coluna Em
      // Andamento" num teste (STC-216, suíte E2E precisa de um alvo de drop
      // confiável).
      data-testid={status}
      className={cn(
        "flex max-h-full min-w-60 flex-1 flex-col rounded-lg bg-muted/45 transition-colors",
        isOver && "bg-secondary/10 ring-2 ring-secondary/40",
      )}
      style={{ flexBasis: 264, maxWidth: 340 }}
    >
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          {titulo}
          <span className="rounded-full bg-card px-2 py-px text-[11.5px] font-semibold text-muted-foreground">
            {total}
          </span>
        </div>
      </div>

      <div
        ref={listaRef}
        className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      >
        {erro && <ErroNaColuna mensagem={erro} onTentarDeNovo={onTentarDeNovo} />}
        {erro && demandas.length === 0 ? null : demandas.length === 0 && !temMais ? (
          <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-muted-foreground">
            <Inbox className="size-6" />
            <span className="text-[13px] font-semibold text-foreground">Nenhuma demanda aqui</span>
          </div>
        ) : (
          demandas.map((demanda) => (
            <DemandaCard
              key={demanda.id}
              demanda={demanda}
              onClick={onSelecionarDemanda}
              onRestaurar={onRestaurar}
            />
          ))
        )}
        {!erro && erroAoCarregarMais && (
          <ErroNaColuna mensagem={erroAoCarregarMais} onTentarDeNovo={onTentarDeNovo} />
        )}
        {!erro && !erroAoCarregarMais && temMais && (
          <div
            ref={fimRef}
            data-testid={`fim-${status}`}
            // Leitor de tela ouve "Carregando mais..." sem o foco sair do lugar.
            aria-live="polite"
            className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-muted-foreground"
          >
            {carregandoMais ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Carregando mais...
              </>
            ) : (
              <button
                type="button"
                className="rounded px-2 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                onClick={onCarregarMais}
              >
                Carregar mais
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ErroNaColuna({
  mensagem,
  onTentarDeNovo,
}: {
  mensagem: string;
  onTentarDeNovo?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-1.5 px-3 py-4 text-center text-[12.5px]">
      <span className="text-destructive">{mensagem}</span>
      {onTentarDeNovo && (
        <button
          type="button"
          className="rounded px-2 py-1 font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          onClick={onTentarDeNovo}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
