"use client";

import { useAuth } from "@/hooks/useAuth";
import { redesDoGestaoRH } from "@/lib/redes";
import { useRedeDoModulo } from "./useRedeDoModulo";

/**
 * Rede do Gestão RH (STC-907). Cada rede tem os seus parâmetros, então as
 * telas mostram uma por vez: quem administra as duas (Admin Q&G, Gestão de
 * Operações) escolhe; os demais ficam na sua.
 */
export function useRedeDoGestaoRH() {
  const { redesAdministradas, isPontoFocal } = useAuth();
  return useRedeDoModulo(
    "atlas.gestao-rh.rede",
    redesDoGestaoRH({
      redesAdministradas: redesAdministradas ?? [],
      isPontoFocal: Boolean(isPontoFocal),
    }),
  );
}
