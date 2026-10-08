import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PainelFerias } from "@/components/gestao-rh/PainelFerias";
import { FERIAS_ATIVA } from "@/config/gestaoRH";

export default async function PainelFeriasPage({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string }>;
}) {
  if (!FERIAS_ATIVA) {
    // Links antigos (card de férias do Kanban) abrem o colaborador no
    // Painel de Absenteísmo.
    const { colaborador } = await searchParams;
    redirect(
      colaborador
        ? `/modulos/gestao-rh?colaborador=${encodeURIComponent(colaborador)}`
        : "/modulos/gestao-rh",
    );
  }
  // Suspense exigido pelo App Router: PainelFerias lê ?colaborador=&periodo=
  // (abertura pelo card do Kanban) com useSearchParams().
  return (
    <Suspense fallback={null}>
      <PainelFerias />
    </Suspense>
  );
}
