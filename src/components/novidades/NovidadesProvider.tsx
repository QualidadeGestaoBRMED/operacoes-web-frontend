"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import {
  destaquePendente,
  maisNovaQue,
  visiveisPara,
  type NovidadeResumida,
} from "@/lib/novidades";
import { marcarNovidadesComoVistas } from "@/lib/plataforma";
import { sessaoVerComo } from "@/lib/verComo";

const NovidadesContexto = createContext<NovidadeResumida[]>([]);

/** As entradas, lidas no servidor pelo layout das páginas logadas. */
export function NovidadesProvider({
  novidades,
  children,
}: {
  novidades: NovidadeResumida[];
  children: React.ReactNode;
}) {
  return <NovidadesContexto.Provider value={novidades}>{children}</NovidadesContexto.Provider>;
}

/**
 * O que a pessoa vê das Novidades e o que ainda não viu (STC-877). Até
 * chegarem /auth/me/ (o que ela já viu) e a lista de módulos (o que ela vê),
 * sem ponto, sem janela e sem marcar nada: sem os módulos (a caminho ou com
 * falha), só as gerais contariam, e marcar uma delas deixaria para trás um destaque de
 * módulo publicado antes.
 */
export function useNovidades() {
  const todas = useContext(NovidadesContexto);
  const { modulos, temAdministracao } = useNavegacao();
  const { user, recarregarUsuario } = useAuth();
  // Mesma busca (SWR "modulos") do menu: nenhuma requisição a mais.
  const { isLoading: carregandoModulos, error: falhaNosModulos } = useModulos();
  const ultimaVista = (user as { ultima_novidade_vista?: string } | undefined)
    ?.ultima_novidade_vista;
  const codigos = modulos.map((modulo) => modulo.codigo);
  const chaveDosCodigos = codigos.join(",");
  const visiveis = useMemo(
    () => visiveisPara(todas, chaveDosCodigos ? chaveDosCodigos.split(",") : [], temAdministracao),
    [todas, chaveDosCodigos, temAdministracao],
  );
  const conhecida = ultimaVista !== undefined && !carregandoModulos && !falhaNosModulos;
  const maisNova = visiveis[0];
  const enviando = useRef<string | null>(null);

  /**
   * Marca como vista a mais nova visível, ou `id` (a página de uma novidade
   * marca só ela: se houver outras mais novas, o ponto continua). Só avança.
   * No "ver como" (só leitura), não marca.
   */
  const marcarComoVistas = useCallback(async (id?: string) => {
    const alvo = id ? visiveis.find((novidade) => novidade.id === id) : maisNova;
    if (!conhecida || !alvo || sessaoVerComo()) return;
    if (!maisNovaQue(alvo.id, ultimaVista) || enviando.current === alvo.id) return;
    enviando.current = alvo.id;
    try {
      await marcarNovidadesComoVistas(alvo.id);
      recarregarUsuario();
    } catch {
      // Fica para a próxima abertura.
    } finally {
      enviando.current = null;
    }
  }, [conhecida, visiveis, maisNova, ultimaVista, recarregarUsuario]);

  return {
    visiveis,
    temNovidade: conhecida && !!maisNova && maisNovaQue(maisNova.id, ultimaVista),
    destaque: conhecida ? destaquePendente(visiveis, ultimaVista) : null,
    marcarComoVistas,
  };
}
