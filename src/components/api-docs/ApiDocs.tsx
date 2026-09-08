"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiSchema } from "@/hooks/useApiSchema";
import { useAuth } from "@/hooks/useAuth";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import {
  agruparOperacoesPorTag,
  apenasOperacoesDeLeitura,
  labelRecurso,
  operacoesComCabecalhoDeRecurso,
} from "@/lib/openapi";
import { objetosReferenciados } from "@/lib/openapiAtributos";
import { extrairTabelaMarkdown } from "@/lib/markdownTabela";
import { ConteudoOperacao } from "./ConteudoOperacao";
import { IntroApiDocs } from "./IntroApiDocs";
import { NavLateralApiDocs } from "./NavLateralApiDocs";
import { ObjetoReferencia } from "./ObjetoReferencia";
import { PainelExemplo } from "./PainelExemplo";
import { PainelObjeto } from "./PainelObjeto";
import { SecaoLimitesTaxa } from "./SecaoLimitesTaxa";

export function ApiDocs() {
  const router = useRouter();
  const { isAdminOps, isLoading: carregandoAuth } = useAuth();
  const { doc, isLoading, error, mensagemErro } = useApiSchema();

  // Mesmo padrão de PermissoesAdmin.tsx: página admin-only no front (o
  // schema em si já é protegido no backend por IsAdminOperacoes, ver
  // core/settings/base.py -- isto é só pra não deixar quem não é admin
  // ver a página inteira renderizada antes de um erro genérico).
  useEffect(() => {
    if (!carregandoAuth && !isAdminOps) {
      router.replace("/hub");
    }
  }, [carregandoAuth, isAdminOps, router]);

  const grupos = useMemo(
    () => (doc ? apenasOperacoesDeLeitura(agruparOperacoesPorTag(doc)) : null),
    [doc],
  );
  const operacoes = useMemo(
    () => (grupos ? Array.from(grupos.values()).flat() : []),
    [grupos],
  );
  const cabecalhosRecurso = useMemo(
    () => (grupos ? operacoesComCabecalhoDeRecurso(grupos) : new Set<string>()),
    [grupos],
  );
  const objetos = useMemo(
    () => (doc ? objetosReferenciados(doc, operacoes) : []),
    [doc, operacoes],
  );
  const temLimitesTaxa = useMemo(
    () => extrairTabelaMarkdown(doc?.info.description) !== null,
    [doc],
  );
  const ids = useMemo(
    () => operacoes.map((operacao) => operacao.id),
    [operacoes],
  );
  const refConteudo = useRef<HTMLDivElement>(null);
  // Só pra destacar o item ativo na navegação lateral -- o painel de
  // exemplo NÃO depende mais disso (ver comentário abaixo, cada seção tem
  // o próprio painel sticky, não um painel único trocando de conteúdo).
  const ativo = useScrollSpy(ids, refConteudo);
  // ids só existe depois que o schema carrega -- sem esse fallback, a nav
  // fica sem nenhum item destacado até o usuário rolar pela 1ª vez.
  const ativoEfetivo = ativo ?? ids[0] ?? null;

  if (carregandoAuth || !isAdminOps) return null;

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 gap-6 p-7">
        <Skeleton className="h-full w-64 shrink-0" />
        <Skeleton className="h-full flex-1" />
        <Skeleton className="h-full w-md shrink-0" />
      </div>
    );
  }

  if (error || !doc || !grupos) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {mensagemErro ?? "Não foi possível carregar a documentação da API."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <NavLateralApiDocs
        grupos={grupos}
        ativo={ativoEfetivo}
        cabecalhosRecurso={cabecalhosRecurso}
        objetos={objetos}
        temLimitesTaxa={temLimitesTaxa}
      />

      <div
        ref={refConteudo}
        className="scrollbar-discreta min-w-0 flex-1 overflow-y-auto px-8"
      >
        <IntroApiDocs doc={doc} grupos={grupos} />
        {/* Painel de exemplo dentro do MESMO grid de cada seção (não uma
            3ª coluna solta do lado de fora) -- achado direto do usuário
            testando: o efeito pedido (a caixa da direita "acompanhar" a
            seção ao rolar, igual docs.stripe.com/api/authentication) só
            existe com sticky posicionado DENTRO da própria linha da seção.
            Um painel único fora do loop, com conteúdo trocado via JS, nunca
            se move na tela -- fica sempre parado no mesmo lugar, só o
            conteúdo interno muda. lg:self-start é o que permite o filho
            sticky ficar mais baixo que a célula do grid (senão o grid
            esticaria a célula pra ocupar a MESMA altura da coluna de
            conteúdo, e não sobraria espaço nenhum pro sticky "andar"
            dentro dela). */}
        {operacoes.map((operacao) => (
          <Fragment key={operacao.id}>
            {cabecalhosRecurso.has(operacao.id) && (
              <h3 className="pt-8 pb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase first:pt-0">
                {labelRecurso(operacao.recurso)}
              </h3>
            )}
            <div className="grid gap-8 border-b border-border py-12 first:pt-0 last:border-0 lg:grid-cols-[minmax(0,1fr)_380px]">
              <ConteudoOperacao doc={doc} operacao={operacao} />
              <div className="lg:sticky lg:top-6 lg:self-start">
                <PainelExemplo doc={doc} operacao={operacao} />
              </div>
            </div>
          </Fragment>
        ))}

        {temLimitesTaxa && (
          <div className="border-b border-border py-12 last:border-0">
            <SecaoLimitesTaxa descricao={doc.info.description} />
          </div>
        )}

        {objetos.map((nome) => (
          <div
            key={nome}
            className="grid gap-8 border-b border-border py-12 last:border-0 lg:grid-cols-[minmax(0,1fr)_380px]"
          >
            <ObjetoReferencia doc={doc} nome={nome} />
            <div className="lg:sticky lg:top-6 lg:self-start">
              <PainelObjeto doc={doc} nome={nome} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
