"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

// Sem top offset -- diferente de outros usos de rootMargin nesta base, aqui
// não tem nenhum header fixo/sticky SOBREPONDO o container que rola (o
// cabeçalho da página fica acima dele, como irmão flex, não por cima).
// -65% do fundo: só considera "ativa" a seção cujo topo já cruzou a faixa
// de gatilho perto do topo do container, não qualquer seção parcialmente
// visível na área toda (senão duas seções longas ficariam "ativas" juntas).
const ROOT_MARGIN = "0px 0px -65% 0px";

// root explícito -- achado real testando a página: sem passar `root`, o
// IntersectionObserver observa contra a VIEWPORT inteira por padrão, não
// contra o container que de fato rola (aqui é uma div interna com
// overflow-y-auto, não a janela). Igual o Painel de exemplo nunca trocava
// de conteúdo ao rolar -- a 1ª seção nunca "saía" da viewport (a página
// inteira não rola, só essa div rola por dentro), então nenhuma outra
// seção nunca cruzava a faixa de gatilho.
export function useScrollSpy(
  ids: string[],
  containerRef: RefObject<HTMLElement | null>,
): string | null {
  const [ativo, setAtivo] = useState<string | null>(ids[0] ?? null);
  const visiveisRef = useRef(new Set<string>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elementos = ids
      .map((id) => document.getElementById(id))
      .filter((elemento): elemento is HTMLElement => elemento !== null);
    if (elementos.length === 0) return;

    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting)
            visiveisRef.current.add(entrada.target.id);
          else visiveisRef.current.delete(entrada.target.id);
        }
        // Última em ordem de documento entre as visíveis -- é a seção mais
        // recente cujo topo já passou da faixa de corte.
        const ultimaVisivel = ids
          .filter((id) => visiveisRef.current.has(id))
          .pop();
        if (ultimaVisivel) setAtivo(ultimaVisivel);
      },
      { root: container, rootMargin: ROOT_MARGIN },
    );

    for (const elemento of elementos) observer.observe(elemento);
    return () => observer.disconnect();
  }, [ids, containerRef]);

  return ativo;
}
