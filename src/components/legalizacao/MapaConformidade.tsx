"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { unidadesDoUsuario as unidadesDe } from "@/lib/redes";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import {
  calcularGradeMapa,
  calcularResumoMapa,
  checklistDaCelula,
  indiceDoChecklist,
} from "@/lib/legalizacaoMapa";
import { MatrizMapaGrid } from "./MatrizMapaGrid";
import { ResumoCards } from "./ResumoCards";
import { ToggleMapaLista } from "./ToggleMapaLista";
import type { CategoriaDocumento } from "@/types/legalizacao";

export function MapaConformidade() {
  const router = useRouter();
  // Decisão de produto -- Mapa é uma grade densa (176px + 7 colunas fixas)
  // sem layout mobile nenhum (fast-follow, PLANEJAMENTO_LEGALIZACAO.md);
  // em telas estreitas só a Lista fica disponível. Mesmo breakpoint de
  // MatrizFiltros.tsx. Redireciona antes de renderizar a grade quebrada,
  // não só esconde o link no toggle -- cobre também quem chega direto por
  // um link salvo/compartilhado em mobile.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const { user, isLoading: carregandoSessao, isCoordenacaoUnidade } = useAuth();
  const unidadesDoUsuario = unidadesDe(user);
  const redireciona = ehMobile;
  useEffect(() => {
    if (redireciona) router.replace("/modulos/legalizacao");
  }, [redireciona, router]);

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
    unidades: todasAsUnidades,
    isLoading: carregandoUnidades,
    error: erroUnidades,
  } = useUnidades("padrao");
  // STC-513: Coordenação da Unidade só acompanha a própria unidade -- em vez
  // de redirecionar pra fora do Mapa (STC-451, revertido por pedido da
  // Solicitante), a grade passa a conter só a unidade dele. Filtrar aqui
  // resolve ResumoCards/MatrizMapaGrid de uma vez só, já que os dois
  // derivam genericamente da grade (mesmo padrão da STC-512 em
  // BibliotecaDocumentos.tsx/MatrizFiltros.tsx).
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidadesDoUsuario.includes(unidade.id))
    : todasAsUnidades;

  // carregandoSessao entra aqui (não só carregandoPrimeiraVez/carregandoUnidades):
  // isCoordenacaoUnidade nasce false enquanto a sessão carrega (useAuth.ts),
  // então sem isso a grade podia renderizar de vez com TODAS as unidades da
  // rede -- pra depois, um instante depois, estreitar pra só a do usuário --
  // reabrindo o mesmo vazamento visual que motivou esta issue.
  const carregando = carregandoPrimeiraVez || carregandoUnidades || carregandoSessao;
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

  // Dica de cada célula (STC-866): o catálogo da categoria com o que a
  // unidade já cadastrou. Sem o catálogo (carregando ou falhou), sem dica.
  const { tiposDocumento } = useTiposDocumento();
  const indice = useMemo(() => indiceDoChecklist(documentos), [documentos]);
  const checklist =
    tiposDocumento.length > 0
      ? (unidadeId: number, categoria: CategoriaDocumento) =>
          checklistDaCelula(indice, tiposDocumento, unidadeId, categoria)
      : undefined;

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
          <MatrizMapaGrid grade={grade} carregando={carregando} checklist={checklist} />
        </>
      )}
    </div>
  );
}
