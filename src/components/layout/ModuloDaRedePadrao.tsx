"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * Módulos que só trabalham com a rede padrão (Gestão RH). O
 * Admin Operações Especiais não os tem no menu e, pela URL, volta para o
 * Kanban. Enquanto a sessão (ou o cargo atual dele) carrega, o módulo espera:
 * montar antes dispara as buscas do módulo para quem não deveria fazê-las.
 */
export function ModuloDaRedePadrao({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdminOps, administraRedePadrao, isLoading, confirmandoCargo } = useAuth();
  const soAdminOpex = isAdminOps && !administraRedePadrao;
  // Admin Operações Especiais pela sessão espera o cargo atual: pode ter
  // passado a administrar a rede padrão depois do login.
  const esperando = isLoading || (soAdminOpex && confirmandoCargo);
  const sai = !esperando && soAdminOpex;

  useEffect(() => {
    if (sai) router.replace("/modulos/gestao-demandas");
  }, [sai, router]);

  return esperando || sai ? null : children;
}
