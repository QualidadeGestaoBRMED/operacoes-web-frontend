"use client";

import { useMemo } from "react";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { calcularGradeMapa, calcularResumoMapa } from "@/lib/legalizacaoMapa";
import { MatrizMapaGrid } from "./MatrizMapaGrid";
import { ResumoCards } from "./ResumoCards";
import { ToggleMapaLista } from "./ToggleMapaLista";

export function MapaConformidade() {
  // Sem filtro nenhum de propósito -- o Mapa é o panorama da rede inteira,
  // igual ResumoCards/MatrizMapaGrid precisam ver todas as unidades pra
  // calcular a grade e o resumo por conta própria (agregação client-side,
  // ver lib/legalizacaoMapa.ts).
  const { documentos, carregandoPrimeiraVez, error, mensagemErro } = useDocumentosLegalizacao();
  const { unidades, isLoading: carregandoUnidades } = useUnidades();

  const carregando = carregandoPrimeiraVez || carregandoUnidades;

  // useMemo único: grade e resumo derivam da mesma passada pelos
  // documentos (calcularResumoMapa reaproveita as células já calculadas em
  // vez de reprocessar a lista do zero).
  const { grade, resumo } = useMemo(() => {
    if (carregando) return { grade: undefined, resumo: undefined };
    const gradeCalculada = calcularGradeMapa(documentos, unidades);
    return { grade: gradeCalculada, resumo: calcularResumoMapa(documentos, gradeCalculada) };
  }, [documentos, unidades, carregando]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToggleMapaLista
        ativo="mapa"
        dica="Panorama por unidade e categoria regulatória · clique numa célula pra ver a lista filtrada"
      />

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemErro}
        </div>
      ) : (
        <>
          <ResumoCards resumo={resumo} carregando={carregando} />
          <MatrizMapaGrid grade={grade} carregando={carregando} />
        </>
      )}
    </div>
  );
}
