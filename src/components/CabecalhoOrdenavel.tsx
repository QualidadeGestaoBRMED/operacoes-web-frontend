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
  const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={ativa ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : undefined}
      className={className}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={cn(
          "group inline-flex items-center gap-1 text-left uppercase hover:text-foreground",
          ativa && "text-foreground",
        )}
      >
        {rotulo}
        {/* opacity-70 nas inativas: menos que isso, não parece clicável. */}
        <Icone
          aria-hidden
          className={cn("size-3 shrink-0", !ativa && "opacity-70 group-hover:opacity-100")}
        />
      </button>
    </th>
  );
}
