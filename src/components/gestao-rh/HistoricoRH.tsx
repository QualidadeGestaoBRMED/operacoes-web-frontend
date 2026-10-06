"use client";

import { useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { textoHistorico } from "@/lib/gestaoRHFerias";
import { formatarDataHora } from "@/lib/utils";
import type { RegistroHistoricoRH } from "@/types/gestaoRH";

function ItemHistorico({ registro }: { registro: RegistroHistoricoRH }) {
  return (
    <li className="flex gap-3 pb-3.5 last:pb-0">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary/50 bg-secondary/10 text-secondary">
        <HistoryIcon aria-hidden className="size-3" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 text-[12.5px]">
        <p className="text-foreground">{textoHistorico(registro)}</p>
        {registro.justificativa && (
          <p className="mt-0.5 text-muted-foreground">“{registro.justificativa}”</p>
        )}
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatarDataHora(registro.em)} · {registro.automatico ? "automático" : registro.por}
        </p>
      </div>
    </li>
  );
}

// A API devolve o histórico do mais recente para o mais antigo.
const HISTORICO_RESUMIDO = 5;

/** Histórico de uma aba do modal (mesmo formato nas abas Férias e Absenteísmo). */
export function HistoricoRH({ id, registros }: { id: string; registros: RegistroHistoricoRH[] }) {
  const [completo, setCompleto] = useState(false);
  const exibidos = completo ? registros : registros.slice(0, HISTORICO_RESUMIDO);
  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3 pt-2">
      <h3
        id={`${id}-titulo`}
        className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase"
      >
        Histórico
      </h3>
      {registros.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <>
          <ul>
            {exibidos.map((registro, indice) => (
              <ItemHistorico key={`${registro.em}-${indice}`} registro={registro} />
            ))}
          </ul>
          {registros.length > HISTORICO_RESUMIDO && (
            <button
              type="button"
              onClick={() => setCompleto((atual) => !atual)}
              className="text-[12.5px] font-medium text-secondary hover:underline"
            >
              {completo ? "Ver só os mais recentes" : `Ver histórico completo (${registros.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
