"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
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
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { usePainelFerias } from "@/hooks/useFeriasGestaoRH";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRedeDoGestaoRH } from "@/hooks/useRedeDoGestaoRH";
import { useUnidades } from "@/hooks/useUnidades";
import { filtroDeUnidadeDosPaineis, unidadesDoUsuario as unidadesDe } from "@/lib/redes";
import {
  JANELA_PADRAO,
  JANELAS_PAINEL,
  ORDEM_STATUS_PERIODO,
  ROTULO_STATUS_PERIODO,
  ordenarLinhasFerias,
  type CampoOrdenavelFerias,
  type OrdenacaoFerias,
} from "@/lib/gestaoRHFerias";
import { cn, formatarDataHora, hojeISO } from "@/lib/utils";
import type { LinhaPainelFerias, StatusPeriodoFerias } from "@/types/gestaoRH";
import { CardsFerias } from "./CardsFerias";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";
import { TabelaFerias } from "./TabelaFerias";
import { proximaOrdenacao } from "@/lib/ordenacao";
import { SeletorRedeGestaoRH } from "./SeletorRedeGestaoRH";

function numeroDaUrl(valor: string | null): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  return Number(valor);
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function PainelFerias() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Uma rede por vez, como no Painel de Absenteísmo (STC-907).
  const { user, redesAdministradas } = useAuth();
  const { rede } = useRedeDoGestaoRH();
  const unidadesDoUsuario = unidadesDe(user);
  const { unidades } = useUnidades(rede);
  const filtroUnidade = filtroDeUnidadeDosPaineis(
    unidades,
    (redesAdministradas ?? []).includes(rede),
    unidadesDoUsuario,
  );

  const [janela, setJanela] = useState<number>(JANELA_PADRAO);
  const [unidade, setUnidade] = useState<number>();
  // A unidade filtrada é da rede anterior: trocar de rede volta para todas.
  const [redeDoFiltro, setRedeDoFiltro] = useState(rede);
  if (redeDoFiltro !== rede) {
    setRedeDoFiltro(rede);
    setUnidade(undefined);
  }
  const [status, setStatus] = useState<StatusPeriodoFerias>();
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoFerias | null>(null);

  const filtros = useMemo(
    () => ({ rede, janela_dias: janela, unidade, status }),
    [rede, janela, unidade, status],
  );
  const { painel, carregandoPrimeiraVez, trocandoFiltro, mensagemErro, recarregar } =
    usePainelFerias(filtros);
  const hoje = hojeISO();

  // Modal aberto pela URL: clique na linha e card do Kanban
  // (origem_url = /modulos/gestao-rh/ferias?colaborador=<id>&periodo=<id>).
  const colaboradorAberto = numeroDaUrl(searchParams.get("colaborador"));
  const periodoEmFoco = numeroDaUrl(searchParams.get("periodo"));

  function abrir(linha: LinhaPainelFerias) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("colaborador", String(linha.colaborador.id));
    params.delete("periodo");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function fechar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("colaborador");
    params.delete("periodo");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
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
    return ordenarLinhasFerias(filtradas, ordenacao);
  }, [painel, busca, ordenacao]);

  function alternarOrdenacao(campo: CampoOrdenavelFerias) {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  }

  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();
  // Mesmo breakpoint dos filtros da Matriz: no celular, cards e filtros não
  // deixam altura para a tabela, então a página rola inteira.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const temFiltros = Boolean(unidade || status || busca);
  const cards = painel?.cards;

  return (
    <div ref={refPai} className={cn("flex h-full min-h-0 flex-col", ehMobile && "overflow-y-auto")}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SeletorRedeGestaoRH />
          <div className="flex items-center gap-2">
            <Label htmlFor="janela-ferias" className="text-[13px] font-semibold">
              Marcos nos próximos
            </Label>
            <Select value={String(janela)} onValueChange={(valor) => setJanela(Number(valor))}>
              <SelectTrigger id="janela-ferias" size="sm" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {JANELAS_PAINEL.map((dias) => (
                  <SelectItem key={dias} value={String(dias)}>
                    {dias} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Quem tem demanda aberta ou limite vencido aparece sempre.
          </p>
        </div>
        {cards && (
          <p className="text-[12px] text-muted-foreground">
            {cards.alertas_na_janela} {cards.alertas_na_janela === 1 ? "alerta" : "alertas"} e{" "}
            {cards.demandas_na_janela}{" "}
            {cards.demandas_na_janela === 1 ? "demanda gerada" : "demandas geradas"} nos últimos{" "}
            {janela} dias ·{" "}
            {cards.ultima_importacao
              ? `Última importação: ${formatarDataHora(cards.ultima_importacao)}`
              : "Nenhuma importação ainda"}
          </p>
        )}
      </div>

      {/* Falha numa revalidação (ex.: depois de programar férias) mantém
          cards, filtros e tabela; só sem dado nenhum o erro ocupa a tela. */}
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
          <div className={cn("transition-opacity", trocandoFiltro && "opacity-60")}>
            <CardsFerias cards={cards} />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-7">
            <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
              <Label htmlFor="busca-ferias" className="sr-only">
                Buscar colaborador
              </Label>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="busca-ferias"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por nome ou matrícula..."
                className="h-9 pl-9"
              />
            </div>

            {/* Coordenação e OPEX já recebem só as próprias unidades da API. */}
            {filtroUnidade.mostrar && (
              <Select
                value={unidade ? String(unidade) : "todas"}
                onValueChange={(valor) =>
                  setUnidade(valor === "todas" ? undefined : Number(valor))
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Unidade">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="todas">{filtroUnidade.rotuloTodas}</SelectItem>
                  {filtroUnidade.opcoes.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={status ?? "todos"}
              onValueChange={(valor) =>
                setStatus(valor === "todos" ? undefined : (valor as StatusPeriodoFerias))
              }
            >
              <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="todos">Todos os status</SelectItem>
                {ORDEM_STATUS_PERIODO.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROTULO_STATUS_PERIODO[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {temFiltros && (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setUnidade(undefined);
                  setStatus(undefined);
                }}
                className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
              >
                <X aria-hidden className="size-3.5" />
                Limpar filtros
              </button>
            )}
          </div>

          <TabelaFerias
            linhas={linhas}
            carregandoPrimeiraVez={carregandoPrimeiraVez}
            hoje={hoje}
            refTabela={refTabela}
            maxHeight={maxHeight}
            ordenacao={ordenacao}
            onOrdenar={alternarOrdenacao}
            rolagemNaPagina={ehMobile}
            atualizando={trocandoFiltro}
            onAbrir={abrir}
          />
        </>
      )}

      <DetalheColaboradorModal
        colaboradorId={colaboradorAberto}
        periodoEmFoco={periodoEmFoco}
        onFechar={fechar}
      />
    </div>
  );
}
