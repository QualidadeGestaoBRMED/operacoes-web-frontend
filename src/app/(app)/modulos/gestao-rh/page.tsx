import { Suspense } from "react";
import { PainelAbsenteismo } from "@/components/gestao-rh/PainelAbsenteismo";

export default function PainelAbsenteismoPage() {
  // Suspense exigido pelo App Router: PainelAbsenteismo lê ?colaborador=
  // com useSearchParams().
  return (
    <Suspense fallback={null}>
      <PainelAbsenteismo />
    </Suspense>
  );
}
