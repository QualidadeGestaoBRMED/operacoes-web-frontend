"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, Info, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePainelHorasExtras } from "@/hooks/useHorasExtrasGestaoRH";
import { usePeriodoEditavel } from "@/hooks/usePeriodoEditavel";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnidades } from "@/hooks/useUnidades";
import { OPCOES_CATEGORIA_PAINEL, mesAnteriorFechado } from "@/lib/gestaoRHAbsenteismo";
import {
  ordenarLinhasHorasExtras,
  type CampoOrdenavelHorasExtras,
  type OrdenacaoHorasExtras,
} from "@/lib/gestaoRHHorasExtras";
import { cn, hojeISO } from "@/lib/utils";
import type {
  CategoriaPainelAbsenteismo,
  FiltrosPainelHorasExtras,
  LinhaHorasExtras,
} from "@/types/gestaoRH";
import { CampoPeriodo } from "./CampoPeriodo";
import { CardsHorasExtras } from "./CardsHorasExtras";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";
import { TabelaHorasExtras } from "./TabelaHorasExtras";

// Carregado à parte: o Recharts não pesa no resto do Gestão RH.
const GraficosHorasExtras = dynamic(
  () => import("./GraficosHorasExtras").then((modulo) => modulo.GraficosHorasExtras),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-3 px-4 sm:px-7 xl:grid-cols-2">
        <Skeleton className="h-[400px] rounded-lg" />
        <Skeleton className="hidden h-[400px] rounded-lg xl:block" />
      </div>
    ),
  },
);

function numeroDaUrl(valor: string | null): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  return Number(valor);
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function EstadoVazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-4 mt-4 mb-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-14 text-center sm:mx-7">
      <Clock aria-hidden className="size-8 text-muted-foreground" />
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="max-w-md text-[13px] text-muted-foreground">{texto}</p>
    </div>
  );
}

export function PainelHorasExtras() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminOps } = useAuth();
  const { unidades } = useUnidades();

  const {
    periodo,
    editado: periodoEditado,
    valido: periodoValido,
    editar: editarPeriodo,
  } = usePeriodoEditavel(mesAnteriorFechado(hojeISO()));
  const [unidade, setUnidade] = useState<number>();
  const [categoria, setCategoria] = useState<CategoriaPainelAbsenteismo>();
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoHorasExtras | null>(null);

  const filtros = useMemo<FiltrosPainelHorasExtras>(
    () => ({ inicio: periodo.inicio, fim: periodo.fim, unidade, categoria }),
    [periodo, unidade, categoria],
  );
  const { painel, carregandoPrimeiraVez, trocandoFiltro, mensagemErro, recarregar } =
    usePainelHorasExtras(filtros);

  const colaboradorAberto = numeroDaUrl(searchParams.get("colaborador"));

  function abrir(linha: LinhaHorasExtras) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("colaborador", String(linha.colaborador.id));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function fechar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("colaborador");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
  }

  function alternarOrdenacao(campo: CampoOrdenavelHorasExtras) {
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: "asc" };
      if (atual.direcao === "asc") return { campo, direcao: "desc" };
      return null;
    });
  }

  const linhas = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtradas = (painel?.linhas ?? []).filter(
      (linha) =>
        !termo ||
        normalizar(linha.colaborador.nome).includes(termo) ||
        linha.colaborador.matricula_vr.includes(termo),
    );
    return ordenarLinhasHorasExtras(filtradas, ordenacao);
  }, [painel, busca, ordenacao]);

  const ehMobile = useMediaQuery("(max-width: 639px)");
  const temFiltros = Boolean(unidade || categoria);
  const semHoraExtra = painel?.com_dado && painel.linhas.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3 sm:px-7">
        <CampoPeriodo
          id="periodo-horas-extras"
          editado={periodoEditado}
          valido={periodoValido}
          onEditar={editarPeriodo}
        />
      </div>

      {mensagemErro && !painel ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-destructive">
          {mensagemErro}
          <Button type="button" variant="outline" size="sm" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {mensagemErro && (
            <div
              role="alert"
              className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive sm:mx-7"
            >
              Não foi possível atualizar o painel; os dados abaixo podem estar desatualizados.
              <Button type="button" variant="outline" size="sm" onClick={recarregar}>
                Tentar novamente
              </Button>
            </div>
          )}

          {painel?.parcial && (
            <div
              role="status"
              className="mx-4 mt-3 flex items-start gap-2.5 rounded-md border border-amber-600/25 bg-amber-600/5 px-3 py-2 text-[12.5px] text-foreground sm:mx-7"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
              <span>
                <strong className="font-semibold">Período parcial:</strong> parte dos dias foi
                importada antes de o VR trazer as horas extras, e os totais não contam esses dias.
              </span>
            </div>
          )}

          <div className={cn("transition-opacity", trocandoFiltro && "opacity-60")}>
            <CardsHorasExtras painel={painel} />
          </div>

          {/* Coordenação e OPEX já recebem só a própria unidade da API; TMO e
              Campanha não têm unidade, então os filtros são só do Admin. */}
          {isAdminOps && (
            <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-7">
              <Select
                value={unidade ? String(unidade) : "todas"}
                onValueChange={(valor) => setUnidade(valor === "todas" ? undefined : Number(valor))}
              >
                <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Unidade">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="todas">Todas as unidades</SelectItem>
                  {unidades.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={categoria ?? "todas"}
                onValueChange={(valor) =>
                  setCategoria(valor === "todas" ? undefined : (valor as CategoriaPainelAbsenteismo))
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Categoria">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {OPCOES_CATEGORIA_PAINEL.map((opcao) => (
                    <SelectItem key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {temFiltros && (
                <button
                  type="button"
                  onClick={() => {
                    setUnidade(undefined);
                    setCategoria(undefined);
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
                >
                  <X aria-hidden className="size-3.5" />
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {painel && !painel.com_dado ? (
            <EstadoVazio
              titulo="Sem dado de hora extra neste período"
              texto="O período foi importado antes de o relatório do VR trazer as horas extras (outubro de 2026). Elas aparecem nos períodos importados depois disso, ou depois de reimportar este período."
            />
          ) : semHoraExtra ? (
            <EstadoVazio
              titulo="Sem hora extra no período"
              texto="Nenhum colaborador fez hora extra no período e nos filtros selecionados."
            />
          ) : (
            <>
              <div className={cn("pt-4 transition-opacity", trocandoFiltro && "opacity-60")}>
                {painel && (
                  <GraficosHorasExtras
                    painel={painel}
                    comUnidadeFiltrada={unidade !== undefined}
                    onAbrirColaborador={abrir}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 pt-5 pb-3 sm:px-7">
                <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
                  <Label htmlFor="busca-horas-extras" className="sr-only">
                    Buscar colaborador
                  </Label>
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="busca-horas-extras"
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar por nome ou matrícula..."
                    className="h-9 pl-9"
                  />
                </div>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Info aria-hidden className="size-3.5" />
                  Só quem fez hora extra no período.
                </span>
              </div>

              <TabelaHorasExtras
                painel={painel}
                linhas={linhas}
                carregandoPrimeiraVez={carregandoPrimeiraVez}
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
                rolagemNaPagina={ehMobile}
                atualizando={trocandoFiltro}
                onAbrir={abrir}
              />
            </>
          )}
        </>
      )}

      <DetalheColaboradorModal
        colaboradorId={colaboradorAberto}
        periodoEmFoco={null}
        abaInicial="absenteismo"
        periodoAbsenteismo={periodo}
        onFechar={fechar}
      />
    </div>
  );
}
