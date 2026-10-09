"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { LABEL_CATEGORIA, ORDEM_CATEGORIA } from "@/lib/legalizacaoMatriz";
import {
  COR_BUCKET_CELULA,
  LABEL_BUCKET_CELULA,
  LEGENDA_BUCKET_CELULA,
  ORDEM_LEGENDA_BUCKET,
  celulaDaGrade,
  situacaoNaUrl,
  type BucketCelula,
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
  // Achado no code review: era <button onClick={() => router.push(...)}>,
  // navegação de página de verdade (mesma rota da Lista, só com querystring
  // diferente) tratada como ação local -- sem href real, não dava pra abrir
  // em nova aba (Ctrl/Cmd+clique), nem aparecia "Abrir link em nova guia" no
  // menu de contexto. O próprio ToggleMapaLista.tsx já segue o princípio
  // certo ("navegação entre página é papel de link"), só não tinha sido
  // aplicado aqui.
  function hrefListaFiltrada(
    unidadeId: number,
    categoria: CategoriaDocumento,
    bucket: BucketCelula,
  ): string {
    const situacao = situacaoNaUrl(bucket);
    return (
      `/modulos/legalizacao?unidade=${unidadeId}&categoria=${categoria}` +
      (situacao ? `&situacao=${situacao}` : "")
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
        {/* overflow-y-hidden + scrollbar-gutter:stable -- achado no code
            review: cabeçalho (sem scroll) e corpo (overflow-auto, linha
            abaixo) são dois elementos DOM separados com a MESMA definição
            de colunas (COLUNAS_GRID), mas só o corpo reservava espaço pra
            barra de rolagem vertical quando a lista de unidades excedia a
            altura visível -- as 7 colunas do corpo ficavam alguns pixels
            mais estreitas que as do cabeçalho, desalinhando aos poucos da
            esquerda pra direita. scrollbar-gutter:stable nos dois lados
            (mesmo sem scroll de verdade no cabeçalho) reserva a MESMA
            largura de gutter sempre, garantindo que as colunas casem
            independente de a barra aparecer ou não. */}
        <div
          className={cn(
            "grid shrink-0 gap-1.5 overflow-y-hidden border-b border-border bg-muted px-4 py-2.5 [scrollbar-gutter:stable]",
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

        <div className="scrollbar-discreta flex-1 overflow-auto px-4 py-3 [scrollbar-gutter:stable]">
          {carregando || !grade ? (
            // Achado no code review: Skeleton (bg-muted, sem display:grid
            // próprio) não vira 8 blocos alinhados só por ganhar a classe
            // COLUNAS_GRID -- sem filhos, um grid-template-columns num
            // elemento vazio não tem o que distribuir, então cada linha
            // virava uma barra cheia. Cada linha agora É o container grid
            // (mesma estrutura da linha real logo abaixo), com um
            // Skeleton por coluna dentro dela.
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }, (_, linha) => (
                <div
                  key={linha}
                  className={cn("grid items-center gap-1.5", COLUNAS_GRID)}
                >
                  <Skeleton className="h-5 w-24" />
                  {ORDEM_CATEGORIA.map((categoria) => (
                    <Skeleton key={categoria} className="h-16" />
                  ))}
                </div>
              ))}
            </div>
          ) : grade.unidades.length === 0 ? (
            // Mesmo padrão de MatrizTable.tsx (documentos.length === 0) --
            // achado no code review: sem isso, useUnidades() devolvendo []
            // (ambiente novo antes do seed, ou falha silenciosa) renderizava
            // cabeçalho normal com o corpo inteiro em branco, sem indicação
            // se era "sem dados" ou um bug de carregamento.
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Building2 className="size-8" />
              <span className="text-sm font-medium">
                Nenhuma unidade encontrada
              </span>
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
                    const aria = `${unidade.nome}, ${LABEL_CATEGORIA[categoria]}: ${LABEL_BUCKET_CELULA[celula.bucket]}${celula.contagem > 0 ? `, ${celula.contagem}` : ""}`;
                    const conteudo = (
                      <>
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
                      </>
                    );

                    if (!clicavel) {
                      // Célula "pendente" não tem link de verdade -- não
                      // existe nenhum documento aplicável nessa combinação
                      // unidade×categoria, então não é só "desabilitado
                      // temporariamente", é uma ausência real. Uma <a>
                      // "desabilitada" via aria-disabled continua focável e
                      // clicável por padrão -- <div> não-interativa evita
                      // esse anti-padrão de acessibilidade de vez.
                      return (
                        <div
                          key={categoria}
                          aria-label={aria}
                          className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_6px,var(--card)_6px,var(--card)_12px)] text-muted-foreground"
                        >
                          {conteudo}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={categoria}
                        href={hrefListaFiltrada(unidade.id, categoria, celula.bucket)}
                        aria-label={aria}
                        className={cn(
                          "flex h-16 flex-col items-center justify-center gap-0.5 rounded-md text-white outline-none transition-transform",
                          "cursor-pointer hover:scale-[1.04] hover:shadow-sm",
                          // ring-offset (não só o ring puro do design system,
                          // button.tsx) -- achado no code review: sem
                          // afastar o anel do próprio preenchimento, o teal
                          // do ring/50 podia ter pouco contraste sobre o
                          // fundo colorido da célula (ex. bg-cyan-700, tom
                          // parecido). O offset garante uma faixa da cor do
                          // card entre a célula e o anel, sempre visível
                          // não importa a cor de fundo.
                          "focus-visible:ring-ring/50 focus-visible:ring-offset-card focus-visible:ring-[3px] focus-visible:ring-offset-2",
                          COR_BUCKET_CELULA[celula.bucket],
                        )}
                      >
                        {conteudo}
                      </Link>
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
