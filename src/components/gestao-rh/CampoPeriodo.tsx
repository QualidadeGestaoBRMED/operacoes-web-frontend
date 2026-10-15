import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Periodo } from "@/hooks/usePeriodoEditavel";
import { cn } from "@/lib/utils";

interface CampoPeriodoProps {
  /** Prefixo dos ids dos campos (dois campos de período podem estar na mesma tela). */
  id: string;
  editado: Periodo;
  valido: boolean;
  onEditar: (campo: keyof Periodo, valor: string) => void;
}

const CLASSE_DATA =
  "h-full w-[6.6rem] min-w-0 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0";

/**
 * Período de consulta no mesmo formato do filtro de data da Matriz de
 * Conformidade ("Prazo até"): rótulos e datas dentro de uma borda só.
 */
export function CampoPeriodo({ id, editado, valido, onEditar }: CampoPeriodoProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 shadow-xs",
          !valido && "border-destructive",
        )}
      >
        <Label
          htmlFor={`${id}-inicio`}
          className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
        >
          Período
        </Label>
        <Input
          id={`${id}-inicio`}
          type="date"
          value={editado.inicio}
          onChange={(evento) => onEditar("inicio", evento.target.value)}
          aria-invalid={!valido}
          className={CLASSE_DATA}
        />
        <Label
          htmlFor={`${id}-fim`}
          className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
        >
          até
        </Label>
        <Input
          id={`${id}-fim`}
          type="date"
          value={editado.fim}
          onChange={(evento) => onEditar("fim", evento.target.value)}
          aria-invalid={!valido}
          aria-describedby={valido ? undefined : `${id}-erro`}
          className={CLASSE_DATA}
        />
      </div>
      {!valido && (
        <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">
          Informe início e fim, com o fim depois do início.
        </p>
      )}
    </div>
  );
}
