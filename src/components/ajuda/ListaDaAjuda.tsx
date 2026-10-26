"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FalhaNosModulos } from "@/components/conteudo/FalhaNosModulos";
import { Input } from "@/components/ui/input";
import { agruparArtigos, type ArtigoResumido } from "@/lib/ajuda";
import { useAjuda } from "./AjudaProvider";

export type ArtigoComBusca = ArtigoResumido & {
  /** Texto cru, para a busca. */
  busca: string;
};

/** Sem acento e sem diferença de maiúscula: "conformidade" acha "Conformidade". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Página da Ajuda (STC-878), como a do Linear: busca e os artigos em cards,
 * agrupados ("Primeiros passos", um grupo por módulo, "Administração"). Só
 * os artigos que a pessoa vê: até chegar a lista de módulos, nada.
 */
export function ListaDaAjuda({ artigos }: { artigos: ArtigoComBusca[] }) {
  const { visiveis, modulos, carregando, falha, recarregar } = useAjuda();
  const [busca, setBusca] = useState("");
  const slugsVisiveis = new Set(visiveis.map((artigo) => artigo.slug));
  const termo = normalizar(busca.trim());
  const encontrados = artigos.filter(
    (artigo) =>
      slugsVisiveis.has(artigo.slug) &&
      (!termo || normalizar(`${artigo.titulo} ${artigo.resumo} ${artigo.busca}`).includes(termo)),
  );
  const grupos = agruparArtigos(encontrados, modulos);
  const pronta = !carregando && !falha;

  // O botão (?) de uma tela sem artigo traz para cá com "#grupo-<módulo>":
  // os grupos só aparecem depois dos módulos, então a rolagem vem depois.
  useEffect(() => {
    if (!pronta || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [pronta]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-muted-foreground">Como usar o Atlas, passo a passo.</p>
        <div className="relative sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar na Ajuda..."
            aria-label="Buscar na Ajuda"
            className="h-10 rounded-full pl-9"
          />
        </div>
      </header>

      {carregando ? null : falha ? (
        <FalhaNosModulos texto="Não foi possível carregar a Ajuda." onTentarDeNovo={() => void recarregar()} />
      ) : grupos.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-muted-foreground">
          {termo ? `Nenhum artigo encontrado para "${busca.trim()}".` : "Ainda não há artigos da Ajuda."}
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          {grupos.map((grupo) => (
            <section key={grupo.chave} id={`grupo-${grupo.chave}`} aria-labelledby={`titulo-${grupo.chave}`} className="scroll-mt-6">
              <h2 id={`titulo-${grupo.chave}`} className="text-xl font-semibold tracking-tight text-foreground">
                {grupo.titulo}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.artigos.map((artigo) => (
                  <li key={artigo.slug}>
                    <Link
                      href={`/ajuda/${artigo.slug}`}
                      className="flex h-full flex-col gap-1.5 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/60"
                    >
                      <span className="font-medium text-foreground">{artigo.titulo}</span>
                      <span className="text-sm leading-6 text-muted-foreground">{artigo.resumo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
