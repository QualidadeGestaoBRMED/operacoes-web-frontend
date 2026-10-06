"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePainelAbsenteismo } from "@/hooks/useAbsenteismoGestaoRH";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnidades } from "@/hooks/useUnidades";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  OCORRENCIAS_FILTRO,
  ROTULO_OCORRENCIA,
  mesAnteriorFechado,
  ordenarLinhasAbsenteismo,
  type CampoOrdenavelAbsenteismo,
  type OrdenacaoAbsenteismo,
} from "@/lib/gestaoRHAbsenteismo";
import { cn, formatarDataHora, hojeISO } from "@/lib/utils";
import type {
  FaixaAbsenteismo,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaFiltro,
} from "@/types/gestaoRH";
import { CardsAbsenteismo } from "./CardsAbsenteismo";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";
import { TabelaAbsenteismo } from "./TabelaAbsenteismo";

// "Crítica e atenção" é a combinação mais usada (quem precisa de olhar).
const OPCOES_FAIXA: { valor: string; rotulo: string; faixas: FaixaAbsenteismo[] }[] = [
  { valor: "critica,atencao", rotulo: "Crítica e atenção", faixas: ["critica", "atencao"] },
  { valor: "critica", rotulo: "Só crítica", faixas: ["critica"] },
  { valor: "atencao", rotulo: "Só atenção", faixas: ["atencao"] },
];

function numeroDaUrl(valor: string | null): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  return Number(valor);
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function PainelAbsenteismo() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminOps } = useAuth();
  const { unidades } = useUnidades();

  // O período editado só vira filtro quando é válido: com o fim antes do
  // início, o painel continua mostrando o último período válido.
  const [periodoEditado, setPeriodoEditado] = useState(() => mesAnteriorFechado(hojeISO()));
  const [periodo, setPeriodo] = useState(periodoEditado);
  const [unidade, setUnidade] = useState<number>();
  const [faixa, setFaixa] = useState<string>();
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaFiltro>();
  const [comPendencias, setComPendencias] = useState(false);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoAbsenteismo | null>(null);

  const periodoValido = Boolean(
    periodoEditado.inicio && periodoEditado.fim && periodoEditado.inicio <= periodoEditado.fim,
  );

  function editarPeriodo(campo: "inicio" | "fim", valor: string) {
    const novo = { ...periodoEditado, [campo]: valor };
    setPeriodoEditado(novo);
    if (novo.inicio && novo.fim && novo.inicio <= novo.fim) setPeriodo(novo);
  }

  const filtros = useMemo<FiltrosPainelAbsenteismo>(
    () => ({
      inicio: periodo.inicio,
      fim: periodo.fim,
      unidade,
      faixa: OPCOES_FAIXA.find((opcao) => opcao.valor === faixa)?.faixas,
      ocorrencia: ocorrencia ? [ocorrencia] : undefined,
      com_pendencias: comPendencias || undefined,
    }),
    [periodo, unidade, faixa, ocorrencia, comPendencias],
  );

  const { painel, carregandoPrimeiraVez, mensagemErro, recarregar } = usePainelAbsenteismo(filtros);
  const comFaixas = painel?.parametros.faixas_cadastradas ?? false;
  // Sem faixas cadastradas o filtro de faixa some da tela; então também não
  // pode continuar valendo (ex.: um Admin apagou as faixas nos Parâmetros).
  if (painel && !comFaixas && faixa) setFaixa(undefined);

  const colaboradorAberto = numeroDaUrl(searchParams.get("colaborador"));

  function abrir(linha: LinhaPainelAbsenteismo) {
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

  function alternarOrdenacao(campo: CampoOrdenavelAbsenteismo) {
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
    return ordenarLinhasAbsenteismo(filtradas, ordenacao);
  }, [painel, busca, ordenacao]);

  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const temFiltros = Boolean(unidade || faixa || ocorrencia || comPendencias || busca);
  const cards = painel?.cards;

  return (
    <div ref={refPai} className={cn("flex h-full min-h-0 flex-col", ehMobile && "overflow-y-auto")}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="periodo-inicio" className="text-[13px] font-semibold">
            Período
          </Label>
          <Input
            id="periodo-inicio"
            type="date"
            value={periodoEditado.inicio}
            onChange={(evento) => editarPeriodo("inicio", evento.target.value)}
            aria-invalid={!periodoValido}
            className="h-8 w-40"
          />
          <Label htmlFor="periodo-fim" className="text-[13px] text-muted-foreground">
            até
          </Label>
          <Input
            id="periodo-fim"
            type="date"
            value={periodoEditado.fim}
            onChange={(evento) => editarPeriodo("fim", evento.target.value)}
            aria-invalid={!periodoValido}
            aria-describedby={periodoValido ? undefined : "periodo-erro"}
            className="h-8 w-40"
          />
          {!periodoValido && (
            <p id="periodo-erro" role="alert" className="text-xs text-destructive">
              Informe início e fim, com o fim depois do início.
            </p>
          )}
        </div>
        {cards && (
          <p className="text-[12px] text-muted-foreground">
            {cards.ultima_importacao
              ? `Última importação: ${formatarDataHora(cards.ultima_importacao)}`
              : "Nenhuma importação ainda"}
            {cards.dados_ate && ` · dados até ${formatarDataISO(cards.dados_ate)}`}
          </p>
        )}
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
          <CardsAbsenteismo painel={painel} />

          <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-7">
            <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
              <Label htmlFor="busca-absenteismo" className="sr-only">
                Buscar colaborador
              </Label>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="busca-absenteismo"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por nome ou matrícula..."
                className="h-9 pl-9"
              />
            </div>

            {/* Coordenação e OPEX já recebem só a própria unidade da API. */}
            {isAdminOps && (
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
            )}

            {comFaixas && (
              <Select
                value={faixa ?? "todas"}
                onValueChange={(valor) => setFaixa(valor === "todas" ? undefined : valor)}
              >
                <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Faixa">
                  <SelectValue placeholder="Faixa" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="todas">Todas as faixas</SelectItem>
                  {OPCOES_FAIXA.map((opcao) => (
                    <SelectItem key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={ocorrencia ?? "todas"}
              onValueChange={(valor) =>
                setOcorrencia(valor === "todas" ? undefined : (valor as OcorrenciaFiltro))
              }
            >
              <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Ocorrência">
                <SelectValue placeholder="Ocorrência" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="todas">Todas as ocorrências</SelectItem>
                {OCORRENCIAS_FILTRO.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROTULO_OCORRENCIA[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex h-8 items-center gap-2 rounded-md border border-input px-3 text-[13px] shadow-xs">
              <Checkbox
                checked={comPendencias}
                onCheckedChange={(valor) => setComPendencias(valor === true)}
              />
              Com pendências
            </label>

            {temFiltros && (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setUnidade(undefined);
                  setFaixa(undefined);
                  setOcorrencia(undefined);
                  setComPendencias(false);
                }}
                className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
              >
                <X aria-hidden className="size-3.5" />
                Limpar filtros
              </button>
            )}
          </div>

          <TabelaAbsenteismo
            linhas={linhas}
            carregandoPrimeiraVez={carregandoPrimeiraVez}
            limiteAtrasoMinutos={painel?.parametros.limite_atraso_minutos ?? 15}
            refTabela={refTabela}
            maxHeight={maxHeight}
            ordenacao={ordenacao}
            onOrdenar={alternarOrdenacao}
            rolagemNaPagina={ehMobile}
            onAbrir={abrir}
          />
        </>
      )}

      <DetalheColaboradorModal colaboradorId={colaboradorAberto} periodoEmFoco={null} onFechar={fechar} />
    </div>
  );
}
