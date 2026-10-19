"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { moduloAtivo, subitemAtivo, useNavegacao } from "@/hooks/useNavegacao";
import { cn } from "@/lib/utils";

/**
 * Seções do módulo no celular (STC-787): no computador elas ficam no
 * submenu do menu lateral; no celular, sem menu lateral, viram abas no topo.
 * Só para módulo com mais de uma seção.
 */
export function AbasDoModulo() {
  const pathname = usePathname();
  const { modulos } = useNavegacao();
  const atual = moduloAtivo(modulos, pathname);
  if (!atual || atual.subitens.length < 2) return null;
  const ativo = subitemAtivo(atual.subitens, pathname);

  return (
    <nav
      aria-label={`Seções de ${atual.nome}`}
      className="shrink-0 overflow-x-auto border-b border-border bg-background"
    >
      <ul className="flex min-w-max gap-1 px-3">
        {atual.subitens.map((subitem) => {
          const selecionada = subitem === ativo;
          return (
            <li key={subitem.rota}>
              <Link
                href={subitem.rota}
                aria-current={selecionada ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  selecionada
                    ? "border-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {subitem.curto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
