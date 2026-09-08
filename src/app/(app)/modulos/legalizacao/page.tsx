import { Suspense } from "react";
import { MatrizConformidade } from "@/components/legalizacao/MatrizConformidade";

export default function LegalizacaoPage() {
  // Suspense exigido pelo App Router: MatrizConformidade usa
  // useSearchParams() (STC-379, lê ?unidade=&categoria= vindos do clique
  // numa célula do Mapa).
  return (
    <Suspense fallback={null}>
      <MatrizConformidade />
    </Suspense>
  );
}
