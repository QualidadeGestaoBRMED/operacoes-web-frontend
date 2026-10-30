"use client";

import { useAuth } from "@/hooks/useAuth";

/**
 * As telas do Gestão RH buscam já na rede de quem entra (STC-907). Enquanto
 * a sessão carrega, a rede ainda não é conhecida: a busca iria para a rede
 * própria, que o Admin de Operações Especiais e o Ponto focal não veem
 * (403), e só depois para a deles.
 */
export function EsperaASessao({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  return isLoading ? null : children;
}
