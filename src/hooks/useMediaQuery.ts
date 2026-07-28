"use client";

import { useEffect, useState } from "react";

// Nasce sempre false (mesmo numa media query que bateria true) -- window
// não existe no servidor, então server e client precisam renderizar o
// mesmo valor no 1º render pra não disparar hydration mismatch (mesmo
// cuidado que AppShell.tsx já toma pro auto-hide da sidebar). O valor real
// só chega depois do mount, via useEffect. Ouve "change" no MediaQueryList
// (não só lê matches uma vez) -- ao contrário do AppShell, precisa
// continuar respondendo a redimensionamento/rotação de tela depois do
// mount, não só decidir o estado inicial.
export function useMediaQuery(query: string): boolean {
  const [corresponde, setCorresponde] = useState(false);

  useEffect(() => {
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
