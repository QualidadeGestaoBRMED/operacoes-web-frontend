"use client";

import { useMemo } from "react";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { calcularGradeMapa, calcularResumoMapa } from "@/lib/legalizacaoMapa";
import { MatrizMapaGrid } from "./MatrizMapaGrid";
import { ResumoCards } from "./ResumoCards";
import { ToggleMapaLista } from "./ToggleMapaLista";

export function MapaConformidade() {
  // Sem filtro nenhum de propósito -- o Mapa é o panorama da rede inteira,
  // igual ResumoCards/MatrizMapaGrid precisam ver todas as unidades pra
  // calcular a grade e o resumo por conta própria (agregação client-side,
  // ver lib/legalizacaoMapa.ts).
  const {
    documentos,
    carregandoPrimeiraVez,
    error: erroDocumentos,
    mensagemErro,
  } = useDocumentosLegalizacao();
  // error capturado também aqui -- achado no code review: com só o erro de
  // documentos tratado, uma falha em /unidades/ passava batida (unidades
  // cai no fallback [], a grade renderiza vazia sem nenhum aviso, enquanto
  // os cards continuam mostrando números normais, calculados só a partir de
  // documentos). Duas fontes de dado, os dois erros precisam derrubar a
  // tela igual.
  const {
    unidades,
    isLoading: carregandoUnidades,
    error: erroUnidades,
  } = useUnidades();

  const carregando = carregandoPrimeiraVez || carregandoUnidades;
  const error = erroDocumentos ?? erroUnidades;
  const mensagemDeErro =
    mensagemErro ?? (erroUnidades ? extrairMensagemErro(erroUnidades) : null);

  // useMemo único: grade e resumo derivam da mesma passada pelos
  // documentos (calcularResumoMapa reaproveita as células já calculadas em
  // vez de reprocessar a lista do zero).
  const { grade, resumo } = useMemo(() => {
    if (carregando) return { grade: undefined, resumo: undefined };
    const gradeCalculada = calcularGradeMapa(documentos, unidades);
    return {
      grade: gradeCalculada,
      resumo: calcularResumoMapa(documentos, gradeCalculada),
    };
  }, [documentos, unidades, carregando]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToggleMapaLista
        ativo="mapa"
        dica="Panorama por unidade e categoria regulatória · clique numa célula pra ver a lista filtrada"
      />

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {mensagemDeErro}
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
