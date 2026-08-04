"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect (não useEffect): roda antes do navegador pintar -- sem
// isso, o 1º frame mostraria a linha cortada sem o limite aplicado ainda
// (mesmo cuidado de useMediaQuery.ts). Isomorfo só pra evitar o warning do
// React em SSR; este hook é sempre usado atrás de "use client".
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Trava a altura da tabela num múltiplo exato de linhas inteiras -- sem
// isso, a altura disponível (flex-grow, dinâmica) raramente bate exatamente
// com N linhas inteiras, sobrando um pedaço de ~5-20px da próxima linha
// visível, cortada pela metade. refPai é o container "pai" (o mesmo que
// já tem h-full/flex-grow por fora, dono do cabeçalho+filtro+tabela) --
// alturaDisponivel usa a borda de BAIXO dele menos a borda de CIMA da
// tabela (não a altura total do pai), pra descontar cabeçalho+filtro sem
// precisar somar as alturas deles um por um. Isso também evita loop de
// realimentação: a posição do topo da tabela não muda quando só a altura
// dela (maxHeight) muda -- só o que vem DEPOIS dela mudaria, e não tem
// nada depois.
//
// bonusPx (achado no dogfooding mobile): opcional, soma no espaço
// disponível ANTES de arredondar pra baixo -- usado quando uma seção
// vizinha tem sobra (espaço que nem dava pra mais uma linha dela mesma) e
// essa sobra é repassada pra cá, deixando essa tabela mostrar uma linha a
// mais sem tomar espaço de ninguém. `sobra` no retorno é o espelho disso:
// quanto ESTA tabela deixou de usar, pra quem chamar poder repassar adiante.
export function useAlturaSemLinhaCortada(bonusPx = 0) {
  const refPai = useRef<HTMLDivElement>(null);
  const refTabela = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();
  const [sobra, setSobra] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const pai = refPai.current;
    const tabela = refTabela.current;
    if (!pai || !tabela) return;

    function recalcular() {
      const thead = tabela!.querySelector("thead");
      const primeiraLinha = tabela!.querySelector("tbody tr");
      if (!thead || !primeiraLinha) return;
      const alturaDisponivel =
        pai!.getBoundingClientRect().bottom - tabela!.getBoundingClientRect().top + bonusPx;
      const alturaThead = thead.getBoundingClientRect().height;
      const alturaLinha = primeiraLinha.getBoundingClientRect().height;
      if (alturaLinha <= 0) return;
      const linhasCabem = Math.max(1, Math.floor((alturaDisponivel - alturaThead) / alturaLinha));
      const novaAltura = alturaThead + linhasCabem * alturaLinha;
      setMaxHeight(novaAltura);
      setSobra(Math.max(0, alturaDisponivel - novaAltura));
    }

    recalcular();
    const observer = new ResizeObserver(recalcular);
    observer.observe(pai);
    return () => observer.disconnect();
  });

  return { refPai, refTabela, maxHeight, sobra };
}
