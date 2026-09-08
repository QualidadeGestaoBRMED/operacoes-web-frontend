"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { idObjeto } from "@/lib/openapiAtributos";
import { cn } from "@/lib/utils";
import { labelRecurso } from "@/lib/openapi";
import { ID_LIMITES_TAXA } from "./SecaoLimitesTaxa";
import type { OperacaoDoc } from "@/lib/openapi";

interface NavLateralApiDocsProps {
  grupos: Map<string, OperacaoDoc[]>;
  ativo: string | null;
  // Mesmo Set calculado em ApiDocs.tsx (operacoesComCabecalhoDeRecurso) --
  // precisa ser o MESMO, não recalculado aqui, senão nav e conteúdo podem
  // discordar sobre onde os subtítulos de recurso aparecem.
  cabecalhosRecurso: Set<string>;
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
  onToggle,
}: {
  titulo: string;
  colapsado: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
  cabecalhosRecurso,
  objetos,
  temLimitesTaxa,
}: NavLateralApiDocsProps) {
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

  return (
    <nav className="scrollbar-discreta flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border px-4 py-5">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar endpoint..."
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {Array.from(gruposFiltrados, ([tag, operacoes]) => {
        if (operacoes.length === 0) return null;
        const colapsado = !buscando && colapsados.has(tag);
        return (
          <div key={tag}>
            <CabecalhoGrupo
              titulo={tag}
              colapsado={colapsado}
              onToggle={() => alternar(tag)}
            />
            {!colapsado && (
              <div className="mt-1.5 flex flex-col">
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
                onToggle={() => alternar(CHAVE_REFERENCIA)}
              />
              {!colapsado && (
                <div className="mt-1.5 flex flex-col">
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
