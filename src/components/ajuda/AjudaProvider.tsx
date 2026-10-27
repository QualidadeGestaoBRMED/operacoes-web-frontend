"use client";

import { createContext, useContext, useMemo } from "react";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import { artigosVisiveis, type ArtigoResumido } from "@/lib/ajuda";

const AjudaContexto = createContext<ArtigoResumido[]>([]);

/** Os artigos, lidos no servidor pelo layout das páginas logadas (sem o texto). */
export function AjudaProvider({
  artigos,
  children,
}: {
  artigos: ArtigoResumido[];
  children: React.ReactNode;
}) {
  return <AjudaContexto.Provider value={artigos}>{children}</AjudaContexto.Provider>;
}

/**
 * Os artigos da Ajuda que a pessoa vê (STC-878). `pronta` só depois de
 * chegar a lista de módulos: antes (ou com falha na busca), só os gerais
 * contariam.
 */
export function useAjuda() {
  const todos = useContext(AjudaContexto);
  const { modulos, temAdministracao } = useNavegacao();
  const { isLoading, error, recarregar } = useModulos();
  const chaveDosCodigos = modulos.map((modulo) => modulo.codigo).join(",");
  const visiveis = useMemo(
    () => artigosVisiveis(todos, chaveDosCodigos ? chaveDosCodigos.split(",") : [], temAdministracao),
    [todos, chaveDosCodigos, temAdministracao],
  );
  return {
    visiveis,
    modulos,
    carregando: isLoading,
    falha: Boolean(error),
    recarregar,
  };
}
