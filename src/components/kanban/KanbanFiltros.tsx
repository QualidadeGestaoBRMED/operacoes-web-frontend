"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategorias } from "@/hooks/useCategorias";
import { useSetores } from "@/hooks/useSetores";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { useUnidades } from "@/hooks/useUnidades";
import type { DemandaFiltros, Prioridade } from "@/types";

const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: "urgente", rotulo: "Urgente" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "media", rotulo: "Média" },
  { valor: "baixa", rotulo: "Baixa" },
];

interface KanbanFiltrosProps {
  filtros: DemandaFiltros;
  onMudarFiltros: (filtros: DemandaFiltros) => void;
  onNovaDemanda: () => void;
}

export function KanbanFiltros({ filtros, onMudarFiltros, onNovaDemanda }: KanbanFiltrosProps) {
  const { unidades } = useUnidades();
  const { categorias } = useCategorias();
  const { tiposGestao } = useTiposGestao();
  // Setor não é module-scoped por URL (diferente de tipos-gestao/categorias)
  // -- mesmo critério do FormNovaDemanda: reaproveita o modulo já carregado
  // via TipoGestao em vez de assumir/hardcodar um id.
  const { setores } = useSetores(tiposGestao[0]?.modulo);
  // Busca com debounce local -- não dispara um filtro (e um fetch) a cada
  // tecla, só 300ms depois que o usuário parar de digitar.
  const [buscaLocal, setBuscaLocal] = useState(filtros.search ?? "");

  // Achado no code review: o timer de debounce fechava sobre 'filtros' e
  // 'onMudarFiltros' do momento em que foi agendado -- se o usuário trocasse
  // unidade/prioridade nos 300ms seguintes, o timer disparava depois com o
  // filtro ANTIGO e revertia essa escolha. O ref sempre aponta pro valor
  // mais recente, sem precisar recriar o timer a cada mudança de filtro.
  const filtrosRef = useRef(filtros);
  const onMudarFiltrosRef = useRef(onMudarFiltros);
  useEffect(() => {
    filtrosRef.current = filtros;
    onMudarFiltrosRef.current = onMudarFiltros;
  });

  // Ressincroniza o campo quando 'filtros.search' muda por uma via externa
  // a este componente (ex.: botão Voltar do navegador) -- sem isso, o texto
  // exibido podia ficar diferente do filtro de verdade aplicado ao board.
  // Quando a mudança vem do próprio debounce abaixo, buscaLocal já está
  // igual, então isso não interfere na digitação.
  useEffect(() => {
    setBuscaLocal(filtros.search ?? "");
  }, [filtros.search]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      if (buscaLocal !== (filtrosRef.current.search ?? "")) {
        onMudarFiltrosRef.current({ ...filtrosRef.current, search: buscaLocal || undefined });
      }
    }, 300);
    return () => clearTimeout(temporizador);
  }, [buscaLocal]);

  const temFiltrosAtivos = Boolean(
    filtros.unidade || filtros.setor || filtros.prioridade || filtros.categoria || filtros.search,
  );

  function limparFiltros() {
    setBuscaLocal("");
    onMudarFiltros({});
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-7 py-4">
      <div className="relative w-full max-w-[320px]">
        <label htmlFor="busca-demandas" className="sr-only">
          Buscar demanda por título ou descrição
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="busca-demandas"
          value={buscaLocal}
          onChange={(evento) => setBuscaLocal(evento.target.value)}
          placeholder="Buscar demanda..."
          className="h-9 pl-9"
        />
      </div>

      <Select
        value={filtros.unidade ? String(filtros.unidade) : "todas"}
        onValueChange={(valor) =>
          onMudarFiltros({ ...filtros, unidade: valor === "todas" ? undefined : Number(valor) })
        }
      >
        <SelectTrigger size="sm" className="h-8">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as unidades</SelectItem>
          {unidades.map((unidade) => (
            <SelectItem key={unidade.id} value={String(unidade.id)}>
              {unidade.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.setor ? String(filtros.setor) : "todos"}
        onValueChange={(valor) =>
          onMudarFiltros({ ...filtros, setor: valor === "todos" ? undefined : Number(valor) })
        }
      >
        <SelectTrigger size="sm" className="h-8">
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os setores</SelectItem>
          {setores.map((setor) => (
            <SelectItem key={setor.id} value={String(setor.id)}>
              {setor.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.prioridade ?? "todas"}
        onValueChange={(valor) =>
          onMudarFiltros({
            ...filtros,
            prioridade: valor === "todas" ? undefined : (valor as Prioridade),
          })
        }
      >
        <SelectTrigger size="sm" className="h-8">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as prioridades</SelectItem>
          {PRIORIDADES.map((prioridade) => (
            <SelectItem key={prioridade.valor} value={prioridade.valor}>
              {prioridade.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sem sentido escolher entre uma única opção -- só aparece quando
          houver categoria de verdade pra filtrar. */}
      {categorias.length > 1 && (
        <Select
          value={filtros.categoria ? String(filtros.categoria) : "todas"}
          onValueChange={(valor) =>
            onMudarFiltros({ ...filtros, categoria: valor === "todas" ? undefined : Number(valor) })
          }
        >
          <SelectTrigger size="sm" className="h-8">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.id} value={String(categoria.id)}>
                {categoria.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {temFiltrosAtivos && (
        <button
          type="button"
          onClick={limparFiltros}
          className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
        >
          <X className="size-3.5" />
          Limpar filtros
        </button>
      )}

      <Button className="ml-auto" onClick={onNovaDemanda}>
        Nova Demanda
      </Button>
    </div>
  );
}
