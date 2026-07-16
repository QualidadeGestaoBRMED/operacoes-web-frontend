import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <Card className="gap-0 p-0">
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
                "flex flex-col gap-1 px-[18px] py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-1.5",
                i < ocorrencias.length - 1 && "border-b border-b-border",
                ocorrencia.severidade === "critico"
                  ? "bg-destructive/[0.08]"
                  : "bg-destructive/[0.04]",
              )}
            >
              <Badge
                variant={ocorrencia.severidade === "critico" ? "destructive" : "warning"}
                className="w-[74px] shrink-0 text-[10px] font-bold tracking-wide uppercase"
              >
                {ocorrencia.severidade === "critico" ? "Crítico" : "Atenção"}
              </Badge>

              <div className="sm:min-w-[220px] sm:flex-1">
                <div className="font-semibold text-foreground">{ocorrencia.titulo}</div>
                <div className="text-xs text-muted-foreground">{ocorrencia.subtitulo}</div>
              </div>

              <div className="text-xs text-muted-foreground sm:w-40 sm:shrink-0">
                {ocorrencia.modulo}
              </div>

              <div
                className={cn(
                  "text-xs font-medium sm:w-36 sm:shrink-0",
                  ocorrencia.responsavel ? "text-foreground" : "text-destructive italic",
                )}
              >
                {ocorrencia.responsavel ?? RESPONSAVEL_PENDENTE}
              </div>

              <div className="text-xs text-muted-foreground sm:w-16 sm:shrink-0 sm:text-right">
                {ocorrencia.tempoAtras}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
