"use client";

import { useSession } from "next-auth/react";

const NIVEL_ADMIN_QG = 1;
const NIVEL_ADMIN_OPERACOES = 2;

export function useAuth() {
  const { data: session, status } = useSession();
  const nivel = session?.user?.perfil?.nivel;

  return {
    user: session?.user,
    perfil: session?.user?.perfil,
    isLoading: status === "loading",
    isAdminQG: nivel === NIVEL_ADMIN_QG,
    isAdminOps: nivel !== undefined && nivel <= NIVEL_ADMIN_OPERACOES,
  };
}
