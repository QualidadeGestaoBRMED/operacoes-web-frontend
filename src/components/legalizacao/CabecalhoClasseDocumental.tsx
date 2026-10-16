"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { LABEL_CATEGORIA } from "@/lib/legalizacaoMatriz";
import type { AreaResponsavelDocumento, CategoriaDocumento } from "@/types/legalizacao";

const LABEL_AREA_RESPONSAVEL: Record<AreaResponsavelDocumento, string> = {
  legalizacao: "Legalização",
  coordenacao: "Coordenação da Unidade",
};

// Tempo para o mouse ir do botão ao Popover sem ele fechar no caminho.
const ATRASO_PARA_FECHAR_MS = 150;

/**
 * Cabeçalho de uma classe documental no Mapa: abre os tipos de documento
 * ativos da classe, com a área responsável e o setor de apoio. Popover, não
 * tooltip, para abrir também com toque e teclado; no computador, abre ainda
 * ao passar o mouse.
 */
export function CabecalhoClasseDocumental({ categoria }: { categoria: CategoriaDocumento }) {
  const { tiposDocumento, isLoading, mensagemErro } = useTiposDocumento();
  const [aberto, setAberto] = useState(false);
  // Aberto pelo mouse: o clique seguinte fixa o Popover em vez de fechá-lo.
  const abertoPeloMouse = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tipos = tiposDocumento
    .filter((tipo) => tipo.ativo && tipo.categoria === categoria)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function aoEntrar(evento: PointerEvent) {
    if (evento.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    if (!aberto) {
      abertoPeloMouse.current = true;
      setAberto(true);
    }
  }

  function aoSair(evento: PointerEvent) {
    if (evento.pointerType !== "mouse" || !abertoPeloMouse.current) return;
    timer.current = window.setTimeout(() => {
      abertoPeloMouse.current = false;
      setAberto(false);
    }, ATRASO_PARA_FECHAR_MS);
  }

  function aoMudar(proximo: boolean) {
    window.clearTimeout(timer.current);
    if (!proximo && abertoPeloMouse.current) {
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
        className="flex items-center justify-center gap-1 rounded text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
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
        className="w-[280px] p-0"
      >
        <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">
          {LABEL_CATEGORIA[categoria]}
        </p>
        <div className="scrollbar-discreta max-h-80 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando os tipos de documento...</p>
          ) : mensagemErro ? (
            <p className="text-sm text-destructive">Não foi possível carregar os tipos de documento.</p>
          ) : tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tipo de documento cadastrado nesta classe</p>
          ) : (
            <ul className="space-y-2.5">
              {tipos.map((tipo) => (
                <li key={tipo.id} className="text-sm">
                  <p className="font-medium text-foreground">{tipo.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Responsável: {LABEL_AREA_RESPONSAVEL[tipo.area_responsavel]}
                    {tipo.setor_apoio && ` · Setor de apoio: ${tipo.setor_apoio}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
