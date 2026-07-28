"use client";

import { useDraggable } from "@dnd-kit/core";
import { Calendar, Lock, MessageSquare, Paperclip, RotateCcw } from "lucide-react";
import { COR_PRIORIDADE, LABEL_PRIORIDADE } from "@/lib/kanban";
import { cn, iniciaisDe, nomeExibicao } from "@/lib/utils";
import type { Demanda } from "@/types";

function InfoPrazo({ demanda }: { demanda: Demanda }) {
  if (demanda.status === "concluido") {
    return demanda.data_conclusao ? (
      <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-chart-3">
        <Calendar className="size-3.5 shrink-0" />
        concluída em {formatarData(demanda.data_conclusao)}
      </div>
    ) : null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(`${demanda.data_prevista}T00:00:00`);
  const diasRestantes = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
  const atrasada = diasRestantes < 0;
  const proxima = diasRestantes >= 0 && diasRestantes <= 3;

  return (
    <div
      className={cn(
        "mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground",
        atrasada && "text-destructive",
        proxima && !atrasada && "text-destructive/70",
      )}
    >
      <Calendar className="size-3.5 shrink-0" />
      {atrasada
        ? `atrasada — ${formatarData(demanda.data_prevista)}`
        : formatarData(demanda.data_prevista)}
    </div>
  );
}

function formatarData(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function ConteudoCard({
  demanda,
  onRestaurar,
}: {
  demanda: Demanda;
  onRestaurar?: (demanda: Demanda) => void;
}) {
  const naLixeira = demanda.status === "lixeira";
  const principal = demanda.responsaveis.find((r) => r.tipo === "principal");

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-2 py-[3px] text-[10px] leading-none font-bold tracking-wide text-white uppercase",
            COR_PRIORIDADE[demanda.prioridade],
          )}
        >
          {LABEL_PRIORIDADE[demanda.prioridade]}
        </span>
      </div>

      <div className="mb-2.5 line-clamp-2 text-[13.5px] font-medium text-card-foreground">
        {demanda.titulo}
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
          {demanda.unidade.nome}
        </span>
        {demanda.etiquetas.map((etiqueta) => (
          // Cor vem cadastrada por etiqueta (dado do usuário, não um token de
          // design) -- por isso hex direto via style, diferente das cores de
          // prioridade/status que são fixas no código.
          <span
            key={etiqueta.id}
            className="rounded px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: etiqueta.cor }}
          >
            {etiqueta.nome}
          </span>
        ))}
      </div>

      {demanda.status === "em_revisao" && demanda.aprovador && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded bg-secondary/8 px-2 py-1 text-[11px] font-semibold text-secondary">
          Aguardando: {nomeExibicao(demanda.aprovador)}
        </div>
      )}

      <InfoPrazo demanda={demanda} />

      <div className={cn("my-2 h-px", COR_PRIORIDADE[demanda.prioridade])} />

      {naLixeira ? (
        <button
          type="button"
          onClick={(evento) => {
            evento.stopPropagation();
            onRestaurar?.(demanda);
          }}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[11px] font-semibold text-secondary hover:bg-muted"
        >
          <RotateCcw className="size-3.5" />
          Restaurar
        </button>
      ) : (
        <div className="flex items-center justify-between pt-1">
          <div
            className={cn(
              "flex size-[22px] items-center justify-center rounded-full text-[9.5px] font-bold",
              principal ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {principal ? iniciaisDe(nomeExibicao(principal.usuario)) : "—"}
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1" title="Comentários">
              <MessageSquare className="size-3.5" />
              {demanda.comentarios_count}
            </span>
            <span className="flex items-center gap-1" title="Anexos">
              <Paperclip className="size-3.5" />
              {demanda.anexos_count}
            </span>
            {demanda.confidencial && (
              <span title="Demanda confidencial">
                <Lock className="size-3.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface DemandaCardProps {
  demanda: Demanda;
  onClick: (demanda: Demanda) => void;
  onRestaurar?: (demanda: Demanda) => void;
}

export function DemandaCard({ demanda, onClick, onRestaurar }: DemandaCardProps) {
  const naLixeira = demanda.status === "lixeira";
  // Card na lixeira não é arrastável -- sair de lá é só pelo botão
  // "Restaurar" (backend trata isso via /restaurar/, não PATCH .../status/).
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: demanda.id,
    disabled: naLixeira,
    // Consumido pelo coordinateGetter customizado do KeyboardSensor (pular
    // direto pra fase seguinte/anterior) -- ele não sabe a fase atual do
    // card sem isso.
    data: { status: demanda.status },
  });

  const principal = demanda.responsaveis.find((r) => r.tipo === "principal");
  // dnd-kit já cobre role="button"/tabIndex/aria-pressed via {...attributes}
  // -- só falta descrever o conteúdo, já que um leitor de tela leria o texto
  // solto na ordem do DOM sem isso. Não wireia onKeyDown aqui: Enter/Espaço
  // já é a tecla que o dnd-kit usa pra iniciar o arraste por teclado: abrir
  // detalhe por teclado é decisão de interação da STC-168 (ainda um no-op).
  const descricaoAcessivel = `Demanda ${demanda.titulo}, prioridade ${LABEL_PRIORIDADE[demanda.prioridade]}, unidade ${demanda.unidade.nome}${principal ? `, responsável ${nomeExibicao(principal.usuario)}` : ", sem responsável principal"}.`;

  return (
    <div
      ref={setNodeRef}
      {...(naLixeira ? {} : listeners)}
      {...(naLixeira ? {} : attributes)}
      onClick={() => onClick(demanda)}
      aria-label={naLixeira ? undefined : descricaoAcessivel}
      className={cn(
        // shrink-0: sem isso, todo filho direto de um container flex tem
        // flex-shrink:1 por padrão do navegador -- quando os cards não
        // cabem mais na coluna, o Flexbox encolhia todos proporcionalmente
        // em vez de deixar o container (overflow-y-auto) rolar, cortando o
        // rodapé de cada card (linha colorida + avatar) pelo overflow-hidden
        // abaixo. Achado testando com 5 cards numa coluna.
        // touch-none (touch-action: none): sem isso, o gesto de arrastar um
        // card por toque (mobile) é interceptado pelo navegador como rolagem
        // da coluna antes do PointerSensor do dnd-kit conseguir reagir --
        // dnd-kit só aplica touch-action:none automaticamente no clone do
        // DragOverlay, não no card de origem. Achado na auditoria de
        // responsividade (STC-186), confirmado lendo o próprio código-fonte
        // do @dnd-kit (baseStyles do PositionedOverlay).
        "shrink-0 touch-none cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-lg",
        naLixeira && "opacity-55",
        // O visual de "sendo arrastado" é o clone no DragOverlay (portalado
        // pra fora dos containers com overflow, senão o card fica atrás das
        // colunas vizinhas e o transform aumenta a área de scroll delas). O
        // card original só precisa sumir do lugar, sem se mover.
        isDragging && "opacity-0",
      )}
    >
      <ConteudoCard demanda={demanda} onRestaurar={onRestaurar} />
    </div>
  );
}

// Clone estático renderizado dentro do <DragOverlay> em KanbanBoard --
// segue o ponteiro por conta própria, então não precisa (e não deve) usar
// useDraggable/transform.
export function DemandaCardArrastando({ demanda }: { demanda: Demanda }) {
  return (
    <div className="cursor-grabbing overflow-hidden rounded-xl border border-border bg-card p-3 shadow-xl">
      <ConteudoCard demanda={demanda} />
    </div>
  );
}
