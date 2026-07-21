"use client";

import { ArrowRightLeft, Pencil, Plus, UserRound, type LucideIcon } from "lucide-react";
import { useHistorico } from "@/hooks/useHistorico";
import { COLUNAS } from "@/lib/kanban";
import { cn, formatarDataHora, nomeOuRemovido } from "@/lib/utils";
import type { CampoHistorico, HistoricoAlteracao } from "@/types";

const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  COLUNAS.map((coluna) => [coluna.status, coluna.titulo]),
);

const ROTULO_CAMPO: Record<CampoHistorico, string> = {
  criacao: "criação",
  titulo: "título",
  descricao: "descrição",
  tipo_gestao: "tipo de gestão",
  prioridade: "prioridade",
  unidade: "unidade",
  setor: "setor",
  categoria: "categoria",
  data_prevista: "prazo",
  confidencial: "confidencialidade",
  status: "status",
  responsavel: "responsável",
};

function truncado(valor: string, tamanho = 60) {
  return valor.length > tamanho ? `${valor.slice(0, tamanho)}…` : valor;
}

// "True"/"False" vem de str(bool) no backend (HistoricoAlteracao.valor_* são
// CharField/TextField genéricos, sem tipo por campo) -- só esse campo precisa
// de tradução, os outros (FK) já chegam com __str__ legível.
function valorLegivel(campo: CampoHistorico, valor: string) {
  if (campo === "confidencial") return valor === "True" ? "confidencial" : "não confidencial";
  if (campo === "status") return ROTULO_STATUS[valor] ?? valor;
  return truncado(valor);
}

function textoDoEvento(evento: HistoricoAlteracao): string {
  const nome = nomeOuRemovido(evento.usuario);
  const { campo_alterado: campo, valor_anterior: de, valor_novo: para } = evento;

  if (campo === "criacao") return `${nome} criou a demanda`;

  if (campo === "responsavel") {
    if (para && de) return `${nome} trocou o responsável de ${de} para ${para}`;
    if (para) return `${nome} adicionou ${para} como responsável`;
    return `${nome} removeu ${de} como responsável`;
  }

  if (campo === "status") {
    return `${nome} moveu de ${valorLegivel(campo, de)} para ${valorLegivel(campo, para)}`;
  }

  const rotulo = ROTULO_CAMPO[campo] ?? campo;
  if (!de) return `${nome} definiu ${rotulo} como "${valorLegivel(campo, para)}"`;
  return `${nome} alterou ${rotulo} de "${valorLegivel(campo, de)}" para "${valorLegivel(campo, para)}"`;
}

const ICONE_POR_CAMPO: Partial<Record<CampoHistorico, LucideIcon>> = {
  criacao: Plus,
  responsavel: UserRound,
  status: ArrowRightLeft,
};

function IconeDoEvento({ campo }: { campo: CampoHistorico }) {
  // Pencil: fallback genérico pra edição de campo (titulo/descricao/etc) --
  // Paperclip seria enganoso aqui, já que anexar arquivo não passa por
  // registrar_historico() no backend (só os 4 gatilhos de auditoria fazem).
  const Icone = ICONE_POR_CAMPO[campo] ?? Pencil;
  const cor =
    campo === "criacao"
      ? "border-chart-3 bg-chart-3/10 text-chart-3"
      : campo === "status"
        ? "border-secondary bg-secondary/10 text-secondary"
        : "border-chart-4 bg-chart-4/10 text-chart-4";

  return (
    <div className={cn("flex size-6.5 shrink-0 items-center justify-center rounded-full border-2", cor)}>
      <Icone className="size-3" />
    </div>
  );
}

export function HistoricoTimeline({ demandaId }: { demandaId: number }) {
  const { historico, isLoading, mensagemErro } = useHistorico(demandaId);

  if (isLoading) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">Carregando histórico...</p>;
  }
  if (mensagemErro) {
    return <p className="px-5 py-4 text-sm text-destructive">{mensagemErro}</p>;
  }
  if (historico.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>;
  }

  return (
    <div className="scrollbar-discreta flex-1 overflow-y-auto px-5 py-4">
      {historico.map((evento, indice) => (
        <div key={evento.id} className="relative flex gap-3.5 pb-4.5 last:pb-0">
          {indice < historico.length - 1 && (
            <div className="absolute top-6.5 bottom-0 left-3.25 w-px bg-border" />
          )}
          <IconeDoEvento campo={evento.campo_alterado} />
          <div className="pt-0.5">
            <p className="text-[13px] text-foreground">{textoDoEvento(evento)}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {formatarDataHora(evento.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
