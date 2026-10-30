"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

/**
 * As telas do Gestão RH buscam já na rede de quem entra (STC-907). Enquanto
 * a sessão carrega (ou o "ver como" é confirmado), a rede ainda não é
 * conhecida: a busca iria para a rede própria, que o Admin de Operações
 * Especiais e o Ponto focal não veem (403), e só depois para a deles. Até
 * lá, o esqueleto das telas: a barra do período, os cards e a tabela.
 */
export function EsperaASessao({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (!isLoading) return children;
  return (
    <div role="status" aria-label="Carregando" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3 sm:px-7">
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-7">
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 px-4 py-4 sm:px-7">
        <Skeleton className="min-h-40 w-full flex-1 rounded-xl" />
      </div>
    </div>
  );
}
