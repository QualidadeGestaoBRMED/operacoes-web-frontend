import { cn } from "@/lib/utils";
import type { OpenApiMetodo } from "@/types/openapi";

// Cores reais de método HTTP (convenção comum de doc de API), não os
// tokens de marca -- mesmo critério já usado pros badges de status/
// prioridade em kanban.ts/legalizacaoMatriz.ts (severidade fica fora dos
// tokens de marca, reservados pro chrome da UI).
const COR_METODO: Record<OpenApiMetodo, string> = {
  get: "bg-cyan-700",
  post: "bg-green-600",
  put: "bg-amber-700",
  patch: "bg-amber-700",
  delete: "bg-red-600",
};

export function BadgeMetodo({
  metodo,
  className,
}: {
  metodo: OpenApiMetodo;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 items-center justify-center rounded-md py-1 text-[11px] font-bold tracking-wide text-white uppercase",
        COR_METODO[metodo],
        className,
      )}
    >
      {metodo}
    </span>
  );
}
