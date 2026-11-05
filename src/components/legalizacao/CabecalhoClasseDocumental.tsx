"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRedeDaLegalizacao } from "@/hooks/useRedeDaLegalizacao";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { LABEL_CATEGORIA, rotuloDaAreaResponsavel } from "@/lib/legalizacaoMatriz";
import type { CategoriaDocumento } from "@/types/legalizacao";

// Só abre pelo mouse parado em cima: atravessar os cabeçalhos não pisca.
const ATRASO_PARA_ABRIR_MS = 300;
// Tempo para o mouse ir do botão ao Popover sem ele fechar no caminho.
const ATRASO_PARA_FECHAR_MS = 150;

// Até 5 tipos à vista; com mais, a lista rola. Cada item tem altura fixa:
// nome em até duas linhas e a área responsável numa, cortados com
// reticências (o texto inteiro fica no title).
const ITENS_VISIVEIS = 5;
const ALTURA_DO_ITEM = 48;
const ESPACO_ENTRE_ITENS = 8;
const ALTURA_MAXIMA_DA_LISTA = ITENS_VISIVEIS * ALTURA_DO_ITEM + (ITENS_VISIVEIS - 1) * ESPACO_ENTRE_ITENS;

/**
 * Cabeçalho de uma classe documental no Mapa: abre os tipos de documento
 * ativos da classe, com a área responsável. Popover, não
 * tooltip, para abrir também com toque e teclado; no computador, abre ainda
 * ao passar o mouse. O botão ocupa a coluna inteira, e o Popover tem a
 * largura dela, para não cobrir as classes vizinhas.
 */
export function CabecalhoClasseDocumental({ categoria }: { categoria: CategoriaDocumento }) {
  const { rede } = useRedeDaLegalizacao();
  const { tiposDocumento, isLoading, mensagemErro } = useTiposDocumento(rede);
  const [aberto, setAberto] = useState(false);
  // Aberto pelo mouse: o clique seguinte fixa o Popover em vez de fechá-lo.
  const abertoPeloMouse = useRef(false);
  // Mouse sobre o botão ou o Popover: só aí o clique fixa em vez de fechar.
  const mouseDentro = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tipos = tiposDocumento
    .filter((tipo) => tipo.ativo && tipo.categoria === categoria)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function aoEntrar(evento: PointerEvent) {
    if (evento.pointerType !== "mouse") return;
    mouseDentro.current = true;
    window.clearTimeout(timer.current);
    if (aberto) return;
    timer.current = window.setTimeout(() => {
      abertoPeloMouse.current = true;
      setAberto(true);
    }, ATRASO_PARA_ABRIR_MS);
  }

  function aoSair(evento: PointerEvent) {
    if (evento.pointerType !== "mouse") return;
    mouseDentro.current = false;
    // Saiu antes de abrir: cancela a abertura.
    window.clearTimeout(timer.current);
    if (!abertoPeloMouse.current) return;
    timer.current = window.setTimeout(() => {
      abertoPeloMouse.current = false;
      setAberto(false);
    }, ATRASO_PARA_FECHAR_MS);
  }

  function aoMudar(proximo: boolean) {
    window.clearTimeout(timer.current);
    // Clique fora (até no cabeçalho vizinho) fecha mesmo se abriu pelo mouse.
    if (!proximo && abertoPeloMouse.current && mouseDentro.current) {
      abertoPeloMouse.current = false;
      return;
    }
    abertoPeloMouse.current = false;
    setAberto(proximo);
  }

  return (
    <Popover open={aberto} onOpenChange={aoMudar}>
      <PopoverTrigger
        onPointerEnter={aoEntrar}
        onPointerLeave={aoSair}
        className="flex w-full items-center justify-center gap-1 rounded text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        {LABEL_CATEGORIA[categoria]}
        <Info aria-hidden className="size-3 shrink-0 opacity-70" />
        <span className="sr-only">, ver os tipos de documento</span>
      </PopoverTrigger>
      <PopoverContent
        onPointerEnter={aoEntrar}
        onPointerLeave={aoSair}
        // Aberto pelo mouse, o foco fica onde estava.
        onOpenAutoFocus={(evento) => abertoPeloMouse.current && evento.preventDefault()}
        onEscapeKeyDown={() => {
          abertoPeloMouse.current = false;
        }}
        collisionPadding={16}
        className="w-(--radix-popover-trigger-width) min-w-0 p-0"
      >
        <p className="border-b border-border px-3 py-2 text-[12px] leading-4 font-semibold">
          {LABEL_CATEGORIA[categoria]}
        </p>
        <div className="px-3 py-2.5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando os tipos de documento...</p>
          ) : mensagemErro ? (
            <p className="text-sm text-destructive">Não foi possível carregar os tipos de documento.</p>
          ) : tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tipo de documento cadastrado nesta classe</p>
          ) : (
            <ul
              className="scrollbar-discreta -mr-2 space-y-2 overflow-y-auto pr-2"
              style={{ maxHeight: ALTURA_MAXIMA_DA_LISTA }}
            >
              {tipos.map((tipo) => {
                const area = rotuloDaAreaResponsavel(tipo.area_responsavel, [rede]);
                return (
                  <li key={tipo.id} className="min-w-0" style={{ height: ALTURA_DO_ITEM }}>
                    <p
                      className="line-clamp-2 text-[12px] leading-4 font-medium break-words text-foreground"
                      title={tipo.nome}
                    >
                      {tipo.nome}
                    </p>
                    <p className="truncate text-[11px] leading-4 text-muted-foreground" title={`Responsável: ${area}`}>
                      {area}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
