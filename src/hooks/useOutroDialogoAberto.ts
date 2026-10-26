"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const SELETOR_QUALQUER_DIALOGO_ABERTO =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

// useLayoutEffect (não useEffect): roda antes do navegador pintar -- sem
// isso, o estado inicial otimista (useState(false), "nenhum outro diálogo
// aberto") deixaria o 1º frame abrir por cima de um diálogo que já estava
// lá antes de checar de verdade. Isomorfo só pra evitar o warning do React
// em SSR (mesmo padrão de useMediaQuery.ts/useAlturaSemLinhaCortada.ts).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Há outro diálogo aberto além do próprio (marcado com `atributoProprio` no
 * DialogContent)? Para os diálogos que abrem sozinhos, montados no AppShell
 * (alerta persistente da Legalização, destaque das Novidades), esperarem em
 * vez de abrir por cima de outro: dois diálogos do Radix montados ao mesmo
 * tempo disputam foco/Tab/Escape entre si, não é só sobreposição visual.
 * MutationObserver (não só checar uma vez) pra reagir tanto a um diálogo
 * abrindo quanto a ele fechando.
 */
export function useOutroDialogoAberto(atributoProprio: string): boolean {
  const [existeOutro, setExisteOutro] = useState(false);

  useIsomorphicLayoutEffect(() => {
    function checar() {
      const abertos = document.querySelectorAll(SELETOR_QUALQUER_DIALOGO_ABERTO);
      setExisteOutro(Array.from(abertos).some((el) => !el.hasAttribute(atributoProprio)));
    }
    checar();
    const observer = new MutationObserver(checar);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-state", "role"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [atributoProprio]);

  return existeOutro;
}
