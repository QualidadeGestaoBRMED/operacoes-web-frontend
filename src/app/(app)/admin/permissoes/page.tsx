import { Suspense } from "react";
import { PermissoesAdmin } from "@/components/admin/PermissoesAdmin";

export default function PermissoesAdminPage() {
  // STC-519: PermissoesAdmin lê ?aba= via useSearchParams() pra abrir
  // direto na aba certa (ex. Catálogo de Legalização, vindo do atalho da
  // sidebar) -- Suspense exigido pelo Next.js pra qualquer client
  // component que usa esse hook. fallback null: a própria página já tem
  // seu próprio esqueleto de carregamento interno (carregandoAuth).
  return (
    <Suspense fallback={null}>
      <PermissoesAdmin />
    </Suspense>
  );
}
