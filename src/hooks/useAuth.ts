"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";

import { obterUsuarioLogado, type UsuarioLogado } from "@/lib/plataforma";
import { useVerComo } from "@/lib/verComo";
import { NIVEL_ADMIN_QG, NIVEL_SETOR, NIVEL_UNIDADE, redesAdministradas } from "@/lib/redes";

export function useAuth() {
  const { data: session, status } = useSession();
  // A sessão guarda os dados do usuário do login; cargo, redes, unidade e
  // setor podem mudar depois (um Admin troca o cargo da pessoa). Os dados
  // atuais vêm da API, buscados de novo ao montar uma tela e ao voltar para
  // a aba; até chegarem (ou se a busca falhar), vale a sessão.
  const usuarioId = session?.user?.usuarioId;
  // "Ver como" (STC-790): os dados atuais são os da pessoa simulada, e até
  // chegarem a tela espera (com a sessão, mostraria o menu do Admin).
  const verComo = useVerComo();
  const { data: atual, error: erroAtual } = useSWR(
    usuarioId ? ["usuario-logado", usuarioId] : null,
    () => obterUsuarioLogado(),
  );
  const user = session?.user && atualizado(session.user, atual);
  const nivel = user?.perfil?.nivel;
  const redes = redesAdministradas(user);

  return {
    user,
    perfil: user?.perfil,
    isLoading: status === "loading" || (Boolean(verComo) && atual === undefined && !erroAtual),
    /** Sessão de "ver como" em andamento nesta aba (só leitura), ou null. */
    verComo: atual?.ver_como ?? null,
    // Dados atuais ainda a caminho: a tela já usa a sessão, mas quem tira a
    // pessoa de uma página pelo cargo espera, senão quem acabou de virar
    // Admin seria mandado embora com o cargo do login.
    confirmandoCargo: Boolean(usuarioId) && atual === undefined && !erroAtual,
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
    isSetorLeg: nivel === NIVEL_SETOR && user?.setor?.codigo === "LEG",
  };
}

type UsuarioDaSessao = NonNullable<ReturnType<typeof useSession>["data"]>["user"];

// O `id` da API é o usuarioId da sessão (o `id` da sessão é o do Google):
// resposta de outra conta (troca de conta em outra aba) não vale. Em "ver
// como", a resposta é da pessoa simulada e vale quando o Admin real dela é
// quem está logado: daí em diante, a tela é a da pessoa, nome e foto
// incluídos.
function atualizado(daSessao: UsuarioDaSessao, atual: UsuarioLogado | undefined): UsuarioDaSessao {
  if (!atual) return daSessao;
  if (atual.ver_como && atual.ver_como.admin.id === daSessao.usuarioId) {
    const nome = [atual.first_name, atual.last_name].filter(Boolean).join(" ").trim();
    return {
      ...daSessao,
      ...atual,
      id: daSessao.id,
      usuarioId: atual.id,
      name: nome || atual.username,
      email: atual.email,
      image: atual.foto_url || null,
    };
  }
  if (atual.id !== daSessao.usuarioId) return daSessao;
  return { ...daSessao, ...atual, id: daSessao.id };
}
