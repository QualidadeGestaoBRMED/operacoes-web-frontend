"use client";

import { useAuth } from "@/hooks/useAuth";
import { redesDaLegalizacao } from "@/lib/redes";
import { useRedeDoModulo } from "./useRedeDoModulo";

/**
 * Rede da Legalização (STC-894). Quem acompanha as duas (Admin Q&G, Gestão
 * de Operações, Setor de Legalização) escolhe; os demais ficam na sua.
 */
export function useRedeDaLegalizacao() {
  const { redesAdministradas, isSetorLeg, isPontoFocal } = useAuth();
  return useRedeDoModulo(
    "atlas.legalizacao.rede",
    redesDaLegalizacao({
      redesAdministradas: redesAdministradas ?? [],
      isSetorLeg: Boolean(isSetorLeg),
      isPontoFocal: Boolean(isPontoFocal),
    }),
  );
}
