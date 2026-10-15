import { Suspense } from "react";
import { PainelHorasExtras } from "@/components/gestao-rh/PainelHorasExtras";

export default function PainelHorasExtrasPage() {
  // Suspense exigido pelo App Router: PainelHorasExtras lê ?colaborador=
  // com useSearchParams().
  return (
    <Suspense fallback={null}>
      <PainelHorasExtras />
    </Suspense>
  );
}
