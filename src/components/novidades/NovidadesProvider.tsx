"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
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
 * chegar a resposta de /auth/me/ não se sabe o que ela já viu: sem ponto e
 * sem janela, para não piscar.
 */
export function useNovidades() {
  const todas = useContext(NovidadesContexto);
  const { modulos, temAdministracao } = useNavegacao();
  const { user, recarregarUsuario } = useAuth();
  const ultimaVista = (user as { ultima_novidade_vista?: string } | undefined)
    ?.ultima_novidade_vista;
  const codigos = modulos.map((modulo) => modulo.codigo);
  const chaveDosCodigos = codigos.join(",");
  const visiveis = useMemo(
    () => visiveisPara(todas, chaveDosCodigos ? chaveDosCodigos.split(",") : [], temAdministracao),
    [todas, chaveDosCodigos, temAdministracao],
  );
  const conhecida = ultimaVista !== undefined;
  const maisNova = visiveis[0];
  const enviando = useRef<string | null>(null);

  /** Marca a mais nova visível como vista. No "ver como" (só leitura), não. */
  const marcarComoVistas = useCallback(async () => {
    if (!conhecida || !maisNova || sessaoVerComo()) return;
    if (!maisNovaQue(maisNova.id, ultimaVista) || enviando.current === maisNova.id) return;
    enviando.current = maisNova.id;
    try {
      await marcarNovidadesComoVistas(maisNova.id);
      recarregarUsuario();
    } catch {
      // Fica para a próxima abertura.
    } finally {
      enviando.current = null;
    }
  }, [conhecida, maisNova, ultimaVista, recarregarUsuario]);

  return {
    visiveis,
    temNovidade: conhecida && !!maisNova && maisNovaQue(maisNova.id, ultimaVista),
    destaque: conhecida ? destaquePendente(visiveis, ultimaVista) : null,
    marcarComoVistas,
  };
}
