"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Compass, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { FalhaNosModulos } from "@/components/conteudo/FalhaNosModulos";
import { Input } from "@/components/ui/input";
import { agruparArtigos, ordenarArtigos, type ArtigoResumido } from "@/lib/ajuda";
import { useAjuda } from "./AjudaProvider";
import { ICONES_DA_AJUDA } from "./iconesDaAjuda";

export type ArtigoComBusca = ArtigoResumido & {
  /** Texto cru, para a busca. */
  busca: string;
};

/** Sem acento e sem diferença de maiúscula: "conformidade" acha "Conformidade". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Máximo de "Mais usados": uma linha de cards no computador, como no Linear. */
const MAIS_USADOS = 4;

/**
 * O ícone do card: o escolhido no artigo; sem ele, o do módulo (o mesmo do
 * menu). Geral e Administração têm o seu.
 */
function iconeDoArtigo(artigo: ArtigoResumido, modulos: { codigo: string; icon: LucideIcon }[]): LucideIcon {
  const escolhido = artigo.icone ? ICONES_DA_AJUDA[artigo.icone] : undefined;
  if (escolhido) return escolhido;
  if (artigo.modulo) return modulos.find((modulo) => modulo.codigo === artigo.modulo)?.icon ?? BookOpen;
  return artigo.admin ? ShieldCheck : Compass;
}

/** Card de um artigo, como os do Linear Docs: o ícone em cima, título e resumo embaixo. */
function CardDoArtigo({ artigo, icone: Icone }: { artigo: ArtigoResumido; icone: LucideIcon }) {
  return (
    <Link
      href={`/ajuda/${artigo.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <span className="flex h-14 items-start border-b border-border bg-muted/40 p-4 sm:h-20 transition-colors group-hover:bg-muted/70">
        <Icone className="size-5 text-primary" aria-hidden />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="font-medium text-foreground">{artigo.titulo}</span>
        <span className="line-clamp-3 text-sm leading-6 text-muted-foreground">{artigo.resumo}</span>
      </span>
    </Link>
  );
}

function Grupo({
  chave,
  titulo,
  artigos,
  modulos,
}: {
  chave: string;
  titulo: string;
  artigos: ArtigoResumido[];
  modulos: { codigo: string; icon: LucideIcon }[];
}) {
  return (
    <section id={`grupo-${chave}`} aria-labelledby={`titulo-${chave}`} className="scroll-mt-6">
      <h3 id={`titulo-${chave}`} className="text-lg font-semibold tracking-tight text-foreground">
        {titulo}
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {artigos.map((artigo) => (
          <li key={artigo.slug}>
            <CardDoArtigo artigo={artigo} icone={iconeDoArtigo(artigo, modulos)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Página da Ajuda (STC-878), como a do Linear Docs: título, busca, "Mais
 * usados" (os artigos `popular`) e os artigos em cards, agrupados
 * ("Primeiros passos", um grupo por módulo, "Administração"). Só os artigos
 * que a pessoa vê: até chegar a lista de módulos, nada.
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
  // Na busca, só os grupos: o mesmo artigo não aparece duas vezes. Também
  // some quando teria todos os artigos: repetiria a página inteira.
  const marcados = encontrados.filter((artigo) => artigo.popular);
  const populares =
    termo || marcados.length === encontrados.length ? [] : ordenarArtigos(marcados).slice(0, MAIS_USADOS);
  const grupos = agruparArtigos(encontrados, modulos);
  const pronta = !carregando && !falha;

  // O botão (?) de uma tela sem artigo traz para cá com "#grupo-<módulo>":
  // os grupos só aparecem depois dos módulos, então a rolagem vem depois.
  useEffect(() => {
    if (!pronta || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [pronta]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Ajuda do Atlas</h2>
          <p className="text-[15px] text-muted-foreground">Como usar o Atlas, passo a passo.</p>
        </div>
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
          {populares.length > 0 && (
            <Grupo chave="mais-usados" titulo="Mais usados" artigos={populares} modulos={modulos} />
          )}
          {grupos.map((grupo) => (
            <Grupo key={grupo.chave} chave={grupo.chave} titulo={grupo.titulo} artigos={grupo.artigos} modulos={modulos} />
          ))}
        </div>
      )}
    </div>
  );
}
