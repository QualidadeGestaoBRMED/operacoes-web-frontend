"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { calcularGradeMapa, calcularResumoMapa } from "@/lib/legalizacaoMapa";
import { MatrizMapaGrid } from "./MatrizMapaGrid";
import { ResumoCards } from "./ResumoCards";
import { ToggleMapaLista } from "./ToggleMapaLista";

export function MapaConformidade() {
  const router = useRouter();
  // Decisão de produto -- Mapa é uma grade densa (176px + 7 colunas fixas)
  // sem layout mobile nenhum (fast-follow, PLANEJAMENTO_LEGALIZACAO.md);
  // em telas estreitas só a Lista fica disponível. Mesmo breakpoint de
  // MatrizFiltros.tsx. Redireciona antes de renderizar a grade quebrada,
  // não só esconde o link no toggle -- cobre também quem chega direto por
  // um link salvo/compartilhado em mobile.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  // STC-451: Coordenação da Unidade só acompanha a própria unidade -- o
  // Mapa é o panorama da rede inteira (sem filtro nenhum, ver comentário
  // abaixo), não faz sentido pra esse perfil. ToggleMapaLista já esconde o
  // link (MatrizConformidade.tsx), isto é a defesa em profundidade pra
  // quem chega direto por um link salvo/compartilhado -- mesmo raciocínio
  // do redirect de mobile logo acima, só que por perfil em vez de largura
  // de tela.
  const { isCoordenacaoUnidade } = useAuth();
  const redireciona = ehMobile || isCoordenacaoUnidade;
  useEffect(() => {
    if (redireciona) router.replace("/modulos/legalizacao");
  }, [redireciona, router]);

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
  } = useUnidades("padrao");

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

  // Depois de todos os hooks (regra dos hooks) -- evita desenhar a grade
  // por um frame antes do redirect dar tempo de disparar.
  if (redireciona) return null;

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
