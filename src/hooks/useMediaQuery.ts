"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// Achado na autochecagem: com useEffect puro, o valor real só chega DEPOIS
// do 1º paint (useEffect roda assíncrono, depois do navegador já ter
// desenhado a tela) -- todo carregamento do board em mobile piscava um
// frame com o layout desktop (filtros quebrando linha) antes de reajustar
// pro layout compacto. useLayoutEffect aplica antes do navegador pintar,
// sem esse flash. isomorfo (useEffect no server) só pra evitar o warning
// do React sobre useLayoutEffect não fazer nada em SSR -- na prática esse
// componente nunca chega a ser renderizado no servidor de verdade (mora
// atrás de um carregandoPrimeiraVez client-only), mas o hook é genérico o
// bastante pra ser reaproveitado em algo que um dia seja SSR de verdade.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Celular: barra inferior no lugar do menu lateral (STC-787).
export const QUERY_MOBILE = "(max-width: 767px)";

// Nasce sempre false (mesmo numa media query que bateria true) -- window
// não existe no servidor, então server e client precisam renderizar o
// mesmo valor no 1º render pra não disparar hydration mismatch (mesmo
// cuidado que AppShell.tsx já toma pro auto-hide da sidebar). Ouve
// "change" no MediaQueryList (não só lê matches uma vez) -- ao contrário
// do AppShell, precisa continuar respondendo a redimensionamento/rotação
// de tela depois do mount, não só decidir o estado inicial.
export function useMediaQuery(query: string): boolean {
  const [corresponde, setCorresponde] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    setCorresponde(mediaQueryList.matches);

    function aoMudar(evento: MediaQueryListEvent) {
      setCorresponde(evento.matches);
    }

    mediaQueryList.addEventListener("change", aoMudar);
    return () => mediaQueryList.removeEventListener("change", aoMudar);
  }, [query]);

  return corresponde;
}
