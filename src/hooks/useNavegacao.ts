"use client";

import { ClipboardList, Home, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModulosNavegacao } from "@/hooks/useModulosNavegacao";

export interface SubitemDeNavegacao {
  label: string;
  rota: string;
  /** Rótulo das abas do módulo no celular, onde o nome inteiro não cabe. */
  curto: string;
}

export interface ModuloDeNavegacao {
  codigo: string;
  nome: string;
  /** Rótulo da barra inferior do celular. */
  nomeCurto: string;
  rota: string;
  icon: LucideIcon;
  subitens: SubitemDeNavegacao[];
}

// Hub escondido por enquanto (bloqueado de vez, ver src/app/(app)/hub/page.tsx):
// com um só módulo ativo, um painel agregador não tem o que agregar ainda.
// Componentes ficam intactos em src/app/(app)/hub/HubContent.tsx -- reativar:
// trocar o redirect de hub/page.tsx e mover "Hub" de volta pra cima como
// módulo ativo (e apontar os redirects de login/raiz pra "/hub" de novo).
// Fica sempre bloqueado, sempre primeiro -- não é um Modulo real do backend,
// não passa pelo cruzamento de status que useModulosNavegacao faz.
const HUB_BLOQUEADO = { nome: "Hub", icon: Home };

const GESTAO_DE_DEMANDAS: ModuloDeNavegacao = {
  codigo: "gestao-demandas",
  nome: "Gestão de Demandas",
  nomeCurto: "Demandas",
  rota: "/modulos/gestao-demandas",
  icon: ClipboardList,
  subitens: [],
};

/**
 * O que cada pessoa vê na navegação, pelo cargo: o menu lateral (computador)
 * e a barra inferior (celular, STC-787) leem daqui, para a regra não ficar
 * em dois lugares.
 */
export function useNavegacao() {
  const { isAdminQG, isAdminOps, administraRedePadrao, isCoordenacaoUnidade, isSetorLeg } =
    useAuth();
  // Módulos com página pronta (codigo/rota em modulos-futuros.ts) e
  // Modulo.status === "ativo" no backend viram link de verdade; o resto
  // (sem rota configurada, ou status "em_breve"/"inativo") fica bloqueado.
  const modulosNavegacao = useModulosNavegacao();
  // STC-747: Legalização e Gestão RH só trabalham com a rede padrão; o Admin
  // Operações Especiais (Admin só da rede OPEX) não os vê até as versões de
  // Operações Especiais.
  const soAdminOpex = isAdminOps && !administraRedePadrao;

  // Subitens do módulo, com os atalhos de Administração por perfil.
  function subitensDoModulo(codigo: string | undefined, base: SubitemDeNavegacao[]) {
    // STC-514/STC-519/STC-521: Coordenador, Admin e Setor de Legalização
    // ganham o Catálogo de Legalização como subitem. Rota própria
    // (/admin/permissoes/catalogo-legalizacao, não /admin/permissoes com
    // query string): sem isso, pathname.startsWith() não distinguia este
    // atalho do link "Administração" (mesmo pathname).
    if (codigo === "legalizacao" && (isCoordenacaoUnidade || administraRedePadrao || isSetorLeg)) {
      return [
        ...base,
        {
          label: "Catálogo de Legalização",
          rota: "/admin/permissoes/catalogo-legalizacao",
          curto: "Catálogo",
        },
      ];
    }
    // STC-728: Parâmetros de Gestão RH (Importação, Equipes, Absenteísmo),
    // só do Admin, como a própria tela; mesma rota própria do Catálogo.
    if (codigo === "gestao-rh" && administraRedePadrao) {
      return [
        ...base,
        {
          label: "Parâmetros de Gestão RH",
          rota: "/admin/permissoes/parametros-gestao-rh",
          curto: "Parâmetros",
        },
      ];
    }
    return base;
  }

  const modulos: ModuloDeNavegacao[] = [
    GESTAO_DE_DEMANDAS,
    ...modulosNavegacao
      .filter(
        (modulo) =>
          modulo.ativo &&
          !(soAdminOpex && (modulo.codigo === "legalizacao" || modulo.codigo === "gestao-rh")),
      )
      // rota as string: useModulosNavegacao só marca ativo=true quando a
      // rota também está preenchida (ver ModuloNavegacao.ativo).
      .map((modulo) => ({
        codigo: modulo.codigo as string,
        nome: modulo.nome,
        nomeCurto: modulo.nome,
        rota: modulo.rota as string,
        icon: modulo.icon,
        subitens: subitensDoModulo(modulo.codigo, modulo.subitens ?? []),
      })),
  ];

  const bloqueados = [HUB_BLOQUEADO, ...modulosNavegacao.filter((modulo) => !modulo.ativo)];

  return {
    modulos,
    bloqueados,
    // isAdminOps (Admin de alguma rede): a tela de Administração.
    temAdministracao: isAdminOps,
    // Django Admin, só do Admin Q&G. NEXT_PUBLIC_API_URL é inlined no build:
    // sem a env, não mostra o link (falha fechada) em vez de um link para
    // "undefined/admin".
    linkDjangoAdmin:
      isAdminQG && process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin`
        : null,
  };
}

/**
 * Subitem ativo: o prefixo mais longo que bate. "/modulos/legalizacao"
 * (Matriz) é prefixo de "/modulos/legalizacao/biblioteca" também.
 */
export function subitemAtivo(subitens: SubitemDeNavegacao[], pathname: string) {
  return [...subitens]
    .sort((a, b) => b.rota.length - a.rota.length)
    .find((subitem) => pathname.startsWith(subitem.rota));
}

/**
 * Módulo em que a pessoa está: pela rota dele ou por um subitem (o Catálogo
 * e os Parâmetros ficam em /admin/permissoes/..., mas são do módulo). A
 * Administração em si (/admin/permissoes) não é de módulo nenhum.
 */
export function moduloAtivo(modulos: ModuloDeNavegacao[], pathname: string) {
  return modulos.find(
    (modulo) => pathname.startsWith(modulo.rota) || Boolean(subitemAtivo(modulo.subitens, pathname)),
  );
}
