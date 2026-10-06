import { Suspense } from "react";
import { PainelFerias } from "@/components/gestao-rh/PainelFerias";

export default function PainelFeriasPage() {
  // Suspense exigido pelo App Router: PainelFerias lê ?colaborador=&periodo=
  // (abertura pelo card do Kanban) com useSearchParams().
  return (
    <Suspense fallback={null}>
      <PainelFerias />
    </Suspense>
  );
}
