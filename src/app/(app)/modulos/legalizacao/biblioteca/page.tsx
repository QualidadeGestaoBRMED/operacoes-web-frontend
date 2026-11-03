import { Suspense } from "react";
import { BibliotecaDocumentos } from "@/components/legalizacao/BibliotecaDocumentos";
import { SoParaQuemVeTudo } from "@/components/legalizacao/SoParaQuemVeTudo";

export default function LegalizacaoBibliotecaPage() {
  // Suspense exigido pelo App Router: BibliotecaDocumentos usa
  // useSearchParams() (?unidade=, mesmo padrão de LegalizacaoPage).
  return (
    <SoParaQuemVeTudo>
      <Suspense fallback={null}>
        <BibliotecaDocumentos />
      </Suspense>
    </SoParaQuemVeTudo>
  );
}
