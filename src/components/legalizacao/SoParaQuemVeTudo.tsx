"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAlcanceNoModulo, veSoOsProprios } from "@/hooks/useModulosNavegacao";

/**
 * Mapa e Biblioteca mostram a rede inteira (todas as unidades, os arquivos
 * vigentes de todas). Quem vê só os próprios documentos (STC-976) vai para a
 * Lista, que já traz só os dela.
 */
export function SoParaQuemVeTudo({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const soOsProprios = veSoOsProprios(useAlcanceNoModulo("legalizacao"));

  useEffect(() => {
    if (soOsProprios) router.replace("/modulos/legalizacao");
  }, [soOsProprios, router]);

  return soOsProprios ? null : children;
}
