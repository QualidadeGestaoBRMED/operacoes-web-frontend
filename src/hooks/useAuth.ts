"use client";

import { useSession } from "next-auth/react";

import { NIVEL_ADMIN_QG, NIVEL_SETOR, NIVEL_UNIDADE, redesAdministradas } from "@/lib/redes";

export function useAuth() {
  const { data: session, status } = useSession();
  const nivel = session?.user?.perfil?.nivel;
  const redes = redesAdministradas(session?.user);

  return {
    user: session?.user,
    perfil: session?.user?.perfil,
    isLoading: status === "loading",
    isAdminQG: nivel === NIVEL_ADMIN_QG,
    // Admin de alguma rede (STC-747): Admin Q&G, Gestão de Operações, Admin
    // Operações ou Admin Operações Especiais. O backend só devolve a cada
    // Admin os itens da rede dele, então os botões de Admin valem para tudo
    // que ele vê.
    isAdminOps: redes.length > 0,
    redesAdministradas: redes,
    // Configurações sem rede própria (Legalização, Gestão RH, etiquetas e
    // categorias do Kanban) são da rede padrão.
    administraRedePadrao: redes.includes("padrao"),
    administraAsDuasRedes: redes.length === 2,
    // Coordenação da Unidade (perfil nível 3) -- mesmo nível usado no RBAC
    // de backend (accounts.permissions.NIVEL_UNIDADE, legalizacao/views.py
    // ::_documentos_visiveis_para). Usado em Legalização pra restringir
    // telas de panorama da rede (Mapa/Biblioteca/Matriz) à própria unidade
    // desse perfil, em vez de deixar ver a rede inteira.
    isCoordenacaoUnidade: nivel === NIVEL_UNIDADE,
    // STC-521: nível 4 sozinho não basta -- existem outros setores no mesmo
    // nível (RH etc.), então "é Setor LEG" exige nível 4 E setor.codigo
    // === "LEG" (mesmo critério que legalizacao.permissions.e_setor_leg()
    // já usa no backend). setor.codigo só existe na sessão a partir da
    // STC-520 (backend expõe setor aninhado no UsuarioSerializer).
    isSetorLeg: nivel === NIVEL_SETOR && session?.user?.setor?.codigo === "LEG",
  };
}
