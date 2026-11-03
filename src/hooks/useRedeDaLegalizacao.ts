"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAlcanceNoModulo, veSoOsProprios } from "@/hooks/useModulosNavegacao";
import { redesDaLegalizacao } from "@/lib/redes";
import type { Rede } from "@/types";
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

/**
 * Rede das buscas da Lista. Quem vê só os próprios documentos (STC-976) busca
 * nas duas: o backend já restringe aos dela, e o responsável de um setor de
 * apoio pode ter documento de unidade OPEX sem ser da rede OPEX.
 */
export function useRedeDaListaDaLegalizacao(): Rede | undefined {
  const { rede } = useRedeDaLegalizacao();
  const soOsProprios = veSoOsProprios(useAlcanceNoModulo("legalizacao"));
  return soOsProprios ? undefined : rede;
}
