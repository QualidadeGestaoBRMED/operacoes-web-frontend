"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * Módulos que só trabalham com a rede padrão (Legalização, Gestão RH). O
 * Admin Operações Especiais não os tem no menu e, pela URL, volta para o Hub.
 */
export function ModuloDaRedePadrao({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdminOps, administraRedePadrao, isLoading } = useAuth();
  const soAdminOpex = !isLoading && isAdminOps && !administraRedePadrao;

  useEffect(() => {
    if (soAdminOpex) router.replace("/hub");
  }, [soAdminOpex, router]);

  return soAdminOpex ? null : children;
}
