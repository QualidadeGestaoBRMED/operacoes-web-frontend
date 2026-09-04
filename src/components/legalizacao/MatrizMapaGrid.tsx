"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { LABEL_CATEGORIA, ORDEM_CATEGORIA } from "@/lib/legalizacaoMatriz";
import {
  COR_BUCKET_CELULA,
  LABEL_BUCKET_CELULA,
  LEGENDA_BUCKET_CELULA,
  ORDEM_LEGENDA_BUCKET,
  celulaDaGrade,
  type GradeMapa,
} from "@/lib/legalizacaoMapa";
import { cn } from "@/lib/utils";
import type { CategoriaDocumento } from "@/types/legalizacao";

// Mesma largura em ambos os grids (cabeçalho e corpo) -- são dois elementos
// DOM separados (não um <table> com thead/tbody), então precisam da MESMA
// definição de colunas pra ficar alinhados. Um objeto só, reaproveitado nos
// dois lugares, evita divergência entre eles (achado que motivou trocar de
// <table> pra dois grids irmãos, ver comentário no arquivo do mockup:
// th{position:sticky} vazava conteúdo por trás ao rolar).
const COLUNAS_GRID = "grid-cols-[176px_repeat(7,minmax(0,1fr))]";

// Achado no review visual: sem isso, "Atenção" sozinho numa célula não
// deixava óbvio que é a mesma coisa que o card "A vencer / Protocolado" lá
// em cima -- rótulos diferentes pro mesmo conceito, sem nada na tela
// conectando os dois.
function LegendaMapa() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3.5 pt-3 pb-1 text-[11.5px] text-muted-foreground">
      <strong className="font-semibold text-foreground">Legenda:</strong>
      {ORDEM_LEGENDA_BUCKET.map((bucket) => (
        <span
          key={bucket}
          className="flex items-center gap-1.5 whitespace-nowrap"
        >
          <span
            className={cn(
              "size-2.5 rounded-sm",
              bucket === "pendente"
                ? "border border-border bg-muted"
                : COR_BUCKET_CELULA[bucket],
            )}
          />
          {LEGENDA_BUCKET_CELULA[bucket]}
        </span>
      ))}
    </div>
  );
}

interface MatrizMapaGridProps {
  grade: GradeMapa | undefined;
  carregando: boolean;
}

export function MatrizMapaGrid({ grade, carregando }: MatrizMapaGridProps) {
  const router = useRouter();

  function abrirListaFiltrada(
    unidadeId: number,
    categoria: CategoriaDocumento,
  ) {
    router.push(
      `/modulos/legalizacao?unidade=${unidadeId}&categoria=${categoria}`,
    );
  }

  return (
    // px-7 pb-7 no wrapper de fora (não mx-7 no card + pb-1 solto na
    // legenda) -- mesmo padrão de MatrizTable.tsx/LegendaStatus: acabava
    // grudando a legenda no rodapé da viewport, sem respiro embaixo, porque
    // só a própria legenda tinha padding, não o espaço da página como um
    // todo.
    <div className="flex min-h-0 flex-1 flex-col px-7 pb-7">
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div
          className={cn(
            "grid shrink-0 gap-1.5 border-b border-border bg-muted px-4 py-2.5",
            COLUNAS_GRID,
          )}
        >
          <div className="flex items-center text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Unidade
          </div>
          {ORDEM_CATEGORIA.map((categoria) => (
            <div
              key={categoria}
              className="flex items-center justify-center text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              {LABEL_CATEGORIA[categoria]}
            </div>
          ))}
        </div>

        <div className="scrollbar-discreta flex-1 overflow-auto px-4 py-3">
          {carregando || !grade ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 8 }, (_, indice) => (
                <Skeleton key={indice} className={cn("h-16", COLUNAS_GRID)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {grade.unidades.map((unidade) => (
                <div
                  key={unidade.id}
                  className={cn("grid items-center gap-1.5", COLUNAS_GRID)}
                >
                  <div className="truncate pr-2 text-[13px] font-semibold text-foreground">
                    {unidade.nome}
                  </div>
                  {ORDEM_CATEGORIA.map((categoria) => {
                    const celula = celulaDaGrade(grade, unidade.id, categoria);
                    const clicavel = celula.bucket !== "pendente";
                    return (
                      <button
                        key={categoria}
                        type="button"
                        disabled={!clicavel}
                        onClick={() =>
                          abrirListaFiltrada(unidade.id, categoria)
                        }
                        aria-label={`${unidade.nome}, ${LABEL_CATEGORIA[categoria]}: ${LABEL_BUCKET_CELULA[celula.bucket]}${celula.contagem > 0 ? `, ${celula.contagem}` : ""}`}
                        className={cn(
                          "flex h-16 flex-col items-center justify-center gap-0.5 rounded-md text-white transition-transform",
                          clicavel &&
                            "cursor-pointer hover:scale-[1.04] hover:shadow-sm",
                          !clicavel &&
                            "cursor-default border border-border bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_6px,var(--card)_6px,var(--card)_12px)] text-muted-foreground",
                          clicavel && COR_BUCKET_CELULA[celula.bucket],
                        )}
                      >
                        <span className="text-base font-extrabold leading-none">
                          {celula.bucket === "pendente"
                            ? ""
                            : celula.bucket === "regular"
                              ? "✓"
                              : celula.contagem}
                        </span>
                        <span className="text-[9.5px] font-bold tracking-wide uppercase opacity-90">
                          {LABEL_BUCKET_CELULA[celula.bucket]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <LegendaMapa />
    </div>
  );
}
