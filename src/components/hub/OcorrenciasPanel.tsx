import { cn } from "@/lib/utils";

export interface Ocorrencia {
  severidade: "critico" | "atencao";
  titulo: string;
  subtitulo: string;
  modulo: string;
  responsavel?: string;
  tempoAtras: string;
}

const RESPONSAVEL_PENDENTE = "— não atribuído";

export function OcorrenciasPanel({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-[18px] py-3.5">
        <h2 className="text-sm font-bold tracking-tight">Ocorrências que precisam de decisão hoje</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cruza todos os módulos ativos — hoje só Gestão de Demandas tem dado real.
        </p>
      </div>

      {ocorrencias.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-muted-foreground">
          Nenhuma ocorrência pendente no momento.
        </p>
      ) : (
        <ul>
          {ocorrencias.map((ocorrencia, i) => (
            <li
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-x-6 gap-y-1.5 px-[18px] py-3 text-sm",
                i < ocorrencias.length - 1 && "border-b border-b-border",
                ocorrencia.severidade === "critico"
                  ? "bg-destructive/[0.08]"
                  : "bg-destructive/[0.04]",
              )}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                  ocorrencia.severidade === "critico"
                    ? "bg-destructive text-white"
                    : "bg-destructive/20 text-destructive",
                )}
              >
                {ocorrencia.severidade === "critico" ? "Crítico" : "Atenção"}
              </span>

              <div className="min-w-[220px] flex-1">
                <div className="font-semibold text-foreground">{ocorrencia.titulo}</div>
                <div className="text-xs text-muted-foreground">{ocorrencia.subtitulo}</div>
              </div>

              <div className="w-40 shrink-0 text-xs text-muted-foreground">{ocorrencia.modulo}</div>

              <div
                className={cn(
                  "w-36 shrink-0 text-xs font-medium",
                  ocorrencia.responsavel ? "text-foreground" : "text-destructive italic",
                )}
              >
                {ocorrencia.responsavel ?? RESPONSAVEL_PENDENTE}
              </div>

              <div className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {ocorrencia.tempoAtras}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
