import { Suspense } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function GestaoDemandasPage() {
  // Suspense é exigido pelo App Router quando algo na árvore usa
  // useSearchParams() (KanbanBoard usa, pra persistir filtros na URL).
  return (
    <Suspense fallback={null}>
      <KanbanBoard />
    </Suspense>
  );
}
