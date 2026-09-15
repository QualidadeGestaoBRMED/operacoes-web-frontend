import { Suspense } from "react";
import { BibliotecaDocumentos } from "@/components/legalizacao/BibliotecaDocumentos";

export default function LegalizacaoBibliotecaPage() {
  // Suspense exigido pelo App Router: BibliotecaDocumentos usa
  // useSearchParams() (?unidade=, mesmo padrão de LegalizacaoPage).
  return (
    <Suspense fallback={null}>
      <BibliotecaDocumentos />
    </Suspense>
  );
}
