import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ordenacao } from "@/lib/ordenacao";

/**
 * Cabeçalho de coluna que ordena a tabela ao ser clicado: ↑↓ quando a
 * coluna não ordena, ↑ crescente, ↓ decrescente, com `aria-sort` para o
 * leitor de tela. O ciclo do clique é `proximaOrdenacao` (lib/ordenacao.ts);
 * a ordenação em si, `ordenarPor`. O estilo do <th> (sticky, cores, largura,
 * quebra de linha do rótulo) vem de quem usa, em `className`.
 */
export function CabecalhoOrdenavel<Campo extends string>({
  campo,
  rotulo,
  ordenacao,
  onOrdenar,
  className,
}: {
  campo: Campo;
  rotulo: string;
  ordenacao: Ordenacao<Campo> | null;
  onOrdenar: (campo: Campo) => void;
  className?: string;
}) {
  const ativa = ordenacao?.campo === campo;
  // A última palavra vai presa ao ícone: se o rótulo quebrar linha, o ícone
  // não cai sozinho na linha de baixo nem fica solto na lateral da coluna.
  const ultimoEspaco = rotulo.lastIndexOf(" ");
  const comecoDoRotulo = rotulo.slice(0, ultimoEspaco + 1);
  const ultimaPalavra = rotulo.slice(ultimoEspaco + 1);
  const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={ativa ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : undefined}
      className={className}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={cn("group text-left uppercase hover:text-foreground", ativa && "text-foreground")}
      >
        {comecoDoRotulo}
        <span className="whitespace-nowrap">
          {ultimaPalavra}
          {/* opacity-70 nas inativas: menos que isso, não parece clicável. */}
          <Icone
            aria-hidden
            className={cn(
              "ml-1 inline size-3 align-[-0.125em]",
              !ativa && "opacity-70 group-hover:opacity-100",
            )}
          />
        </span>
      </button>
    </th>
  );
}
