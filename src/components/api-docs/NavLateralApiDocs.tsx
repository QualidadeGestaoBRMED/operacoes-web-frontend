"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { idObjeto } from "@/lib/openapiAtributos";
import { cn } from "@/lib/utils";
import {
  LIMIAR_SUBGRUPO_RECURSO,
  cabecalhosRecursoParaLista,
  labelRecurso,
} from "@/lib/openapi";
import { ID_LIMITES_TAXA } from "./SecaoLimitesTaxa";
import type { OperacaoDoc } from "@/lib/openapi";

interface NavLateralApiDocsProps {
  grupos: Map<string, OperacaoDoc[]>;
  ativo: string | null;
  objetos: string[];
  temLimitesTaxa: boolean;
}

const COR_TEXTO_METODO: Record<string, string> = {
  get: "text-cyan-700",
  post: "text-green-600",
  put: "text-amber-700",
  patch: "text-amber-700",
  delete: "text-red-600",
};

// Chave própria pro grupo "Referência" (Limites de taxa + Objetos) -- não é
// um nome de tag real, só a chave usada no Set de colapsados.
const CHAVE_REFERENCIA = "__referencia__";

function CabecalhoGrupo({
  titulo,
  colapsado,
  idConteudo,
  onToggle,
}: {
  titulo: string;
  colapsado: boolean;
  idConteudo: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!colapsado}
      aria-controls={idConteudo}
      className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {colapsado ? (
        <ChevronRight className="size-3 shrink-0" />
      ) : (
        <ChevronDown className="size-3 shrink-0" />
      )}
      {titulo}
    </button>
  );
}

export function NavLateralApiDocs({
  grupos,
  ativo,
  objetos,
  temLimitesTaxa,
}: NavLateralApiDocsProps) {
  const idBusca = useId();
  // Base única (useId) + nome da tag "limpo" -- id de verdade não pode ter
  // espaço (tags reais como "Gestão de Demandas" têm), e aria-controls
  // precisa bater exatamente com o id do bloco de conteúdo.
  const idBaseGrupo = useId();
  const idGrupo = (chave: string) =>
    `${idBaseGrupo}-${chave.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const [busca, setBusca] = useState("");
  // Vazio = tudo expandido (comportamento de antes) -- só entra na lista
  // quem o usuário recolheu manualmente.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  function alternar(chave: string) {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return grupos;

    const filtrados = new Map<string, OperacaoDoc[]>();
    for (const [tag, operacoes] of grupos) {
      const bateram = operacoes.filter(
        (operacao) =>
          operacao.operation.summary?.toLowerCase().includes(termo) ||
          operacao.path.toLowerCase().includes(termo),
      );
      if (bateram.length > 0) filtrados.set(tag, bateram);
    }
    return filtrados;
  }, [grupos, busca]);

  // Busca ativa força tudo expandido -- senão um resultado que bate ficaria
  // escondido atrás de uma seção que o usuário tinha recolhido antes.
  const buscando = busca.trim() !== "";
  const semResultados = buscando && gruposFiltrados.size === 0;

  // Recalculado sobre a lista JÁ FILTRADA (não reaproveita um Set vindo de
  // fora) -- achado no review: um Set calculado sobre a lista completa
  // marca só a 1ª operação de cada recurso ANTES do filtro. Se a busca bate
  // com a 2ª operação de um recurso mas não com a 1ª, o id que carregava o
  // subtítulo fica de fora do resultado filtrado, e o item aparece "solto"
  // sem indicar o recurso.
  //
  // "elegível" (2º argumento de cabecalhosRecursoParaLista) vem do tamanho
  // da tag ANTES do filtro (`grupos`, não `gruposFiltrados`) -- decidir se
  // uma tag tem subdivisão por recurso é uma propriedade estrutural da tag
  // inteira, não do tanto de resultado que uma busca específica deixou
  // visível; do contrário, uma busca que reduz uma tag grande a poucos
  // itens faria os subtítulos sumirem por estarem abaixo do limiar, mesmo
  // a tag sendo genuinamente grande.
  const cabecalhosRecurso = useMemo(() => {
    const comCabecalho = new Set<string>();
    for (const [tag, operacoesFiltradas] of gruposFiltrados) {
      const tamanhoOriginal = grupos.get(tag)?.length ?? 0;
      const elegivel = tamanhoOriginal > LIMIAR_SUBGRUPO_RECURSO;
      for (const id of cabecalhosRecursoParaLista(
        operacoesFiltradas,
        elegivel,
      )) {
        comCabecalho.add(id);
      }
    }
    return comCabecalho;
  }, [gruposFiltrados, grupos]);

  return (
    <nav className="scrollbar-discreta flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border px-4 py-5">
      <div className="relative shrink-0">
        <label htmlFor={idBusca} className="sr-only">
          Buscar endpoint por nome ou path
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={idBusca}
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar endpoint..."
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {semResultados && (
        <p className="px-1 text-[13px] text-muted-foreground">
          Nenhum endpoint encontrado.
        </p>
      )}

      {Array.from(gruposFiltrados, ([tag, operacoes]) => {
        if (operacoes.length === 0) return null;
        const colapsado = !buscando && colapsados.has(tag);
        return (
          <div key={tag}>
            <CabecalhoGrupo
              titulo={tag}
              colapsado={colapsado}
              idConteudo={idGrupo(tag)}
              onToggle={() => alternar(tag)}
            />
            {!colapsado && (
              <div id={idGrupo(tag)} className="mt-1.5 flex flex-col">
                {operacoes.map((operacao) => (
                  <Fragment key={operacao.id}>
                    {cabecalhosRecurso.has(operacao.id) && (
                      <div className="mt-2 px-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase first:mt-0.5">
                        {labelRecurso(operacao.recurso)}
                      </div>
                    )}
                    <a
                      href={`#${operacao.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        ativo === operacao.id &&
                          "bg-muted font-medium text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "w-9 shrink-0 font-mono text-[10px] font-bold uppercase",
                          COR_TEXTO_METODO[operacao.metodo],
                        )}
                      >
                        {operacao.metodo}
                      </span>
                      <span className="truncate">
                        {operacao.operation.summary ?? operacao.path}
                      </span>
                    </a>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(temLimitesTaxa || objetos.length > 0) &&
        (() => {
          const colapsado = !buscando && colapsados.has(CHAVE_REFERENCIA);
          return (
            <div className="border-t border-border pt-4">
              <CabecalhoGrupo
                titulo="Referência"
                colapsado={colapsado}
                idConteudo={idGrupo(CHAVE_REFERENCIA)}
                onToggle={() => alternar(CHAVE_REFERENCIA)}
              />
              {!colapsado && (
                <div
                  id={idGrupo(CHAVE_REFERENCIA)}
                  className="mt-1.5 flex flex-col"
                >
                  {temLimitesTaxa && (
                    <a
                      href={`#${ID_LIMITES_TAXA}`}
                      className="rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Limites de taxa
                    </a>
                  )}
                  {objetos.map((nome) => (
                    <a
                      key={nome}
                      href={`#${idObjeto(nome)}`}
                      className="truncate rounded-md px-2 py-1.5 font-mono text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {nome}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
    </nav>
  );
}
