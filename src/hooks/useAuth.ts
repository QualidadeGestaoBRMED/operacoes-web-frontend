"use client";

import { useSession } from "next-auth/react";

const NIVEL_ADMIN_QG = 1;
const NIVEL_ADMIN_OPERACOES = 2;
const NIVEL_UNIDADE = 3;

export function useAuth() {
  const { data: session, status } = useSession();
  const nivel = session?.user?.perfil?.nivel;

  return {
    user: session?.user,
    perfil: session?.user?.perfil,
    isLoading: status === "loading",
    isAdminQG: nivel === NIVEL_ADMIN_QG,
    isAdminOps: nivel !== undefined && nivel <= NIVEL_ADMIN_OPERACOES,
    // Coordenação da Unidade (perfil nível 3) -- mesmo nível usado no RBAC
    // de backend (accounts.permissions.NIVEL_UNIDADE, legalizacao/views.py
    // ::_documentos_visiveis_para). Usado pra decisão de produto (STC-451):
    // ela só acompanha a própria unidade, então visões "panorama de toda a
    // rede" (Mapa de Conformidade) não fazem sentido pra esse perfil.
    isCoordenacaoUnidade: nivel === NIVEL_UNIDADE,
  };
}
