import { Skeleton } from "@/components/ui/skeleton";

export default function GestaoDemandasPage() {
  return (
    <div className="p-6 md:p-8 lg:p-12">
      <h1 className="text-2xl font-semibold text-foreground">Gestão de Demandas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        O quadro Kanban deste módulo será implementado nas próximas issues.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
