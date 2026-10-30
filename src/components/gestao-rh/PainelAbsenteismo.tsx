"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Search, X } from "lucide-react";
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
import { usePeriodoEditavel } from "@/hooks/usePeriodoEditavel";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRedeDoGestaoRH } from "@/hooks/useRedeDoGestaoRH";
import { useUnidades } from "@/hooks/useUnidades";
import { filtroDeUnidadeDosPaineis, unidadesDoUsuario as unidadesDe } from "@/lib/redes";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  OCORRENCIAS_FILTRO,
  ROTULO_OCORRENCIA,
  diferencaEmPontos,
  mesAnteriorFechado,
  nomeDoPeriodo,
  ordenarLinhasAbsenteismo,
  periodoAnterior,
  periodoEmAndamento,
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
import { CampoPeriodo } from "./CampoPeriodo";
import { SeletorRedeGestaoRH } from "./SeletorRedeGestaoRH";
import { CardsAbsenteismo } from "./CardsAbsenteismo";
import { DetalheColaboradorModal } from "./DetalheColaboradorModal";
import { TabelaAbsenteismo } from "./TabelaAbsenteismo";
import { proximaOrdenacao } from "@/lib/ordenacao";

// Carregado só ao abrir: o gráfico (Recharts) não pesa na abertura do Painel.
const AbsenteismoMensalModal = dynamic(
  () => import("./AbsenteismoMensalModal").then((modulo) => modulo.AbsenteismoMensalModal),
  { ssr: false },
);

// Também só ao abrir: as barras das horas perdidas por tipo e por unidade.
const HorasPerdidasModal = dynamic(
  () => import("./HorasPerdidasModal").then((modulo) => modulo.HorasPerdidasModal),
  { ssr: false },
);

// "Crítica e atenção" é a combinação mais usada (quem precisa de olhar) e o
// filtro com que o painel abre quando há faixas cadastradas.
const FAIXA_PADRAO = "critica,atencao";
const OPCOES_FAIXA: { valor: string; rotulo: string; faixas: FaixaAbsenteismo[] }[] = [
  { valor: "critica,atencao", rotulo: "Crítica e atenção", faixas: ["critica", "atencao"] },
  { valor: "critica", rotulo: "Só crítica", faixas: ["critica"] },
  { valor: "atencao", rotulo: "Só atenção", faixas: ["atencao"] },
];

function numeroDaUrl(valor: string | null): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  return Number(valor);
}

function periodoDaUrl(inicio: string | null, fim: string | null) {
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!inicio || !fim || !data.test(inicio) || !data.test(fim) || inicio > fim) return null;
  return { inicio, fim };
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function PainelAbsenteismo() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Uma rede por vez, cada uma com os seus parâmetros (STC-906/907).
  const { user, redesAdministradas } = useAuth();
  const { rede } = useRedeDoGestaoRH();
  const unidadesDoUsuario = unidadesDe(user);
  const { unidades } = useUnidades(rede);
  const filtroUnidade = filtroDeUnidadeDosPaineis(
    unidades,
    (redesAdministradas ?? []).includes(rede),
    unidadesDoUsuario,
  );

  const {
    periodo,
    editado: periodoEditado,
    valido: periodoValido,
    editar: editarPeriodo,
  } = usePeriodoEditavel(mesAnteriorFechado(hojeISO()));
  const [unidade, setUnidade] = useState<number>();
  // A unidade filtrada é da rede anterior: trocar de rede volta para todas.
  const [redeDoFiltro, setRedeDoFiltro] = useState(rede);
  if (redeDoFiltro !== rede) {
    setRedeDoFiltro(rede);
    setUnidade(undefined);
  }
  const [faixa, setFaixa] = useState<string | undefined>(FAIXA_PADRAO);
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaFiltro>();
  const [comPendencias, setComPendencias] = useState(false);
  // Desligados ficam fora da lista de quem tratar (STC-870); marcando, voltam
  // para consulta. O número da unidade conta-os sempre.
  const [incluirDesligados, setIncluirDesligados] = useState(false);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoAbsenteismo | null>(null);

  // O filtro de faixa vai sempre para a API, mesmo escondido: sem faixas
  // cadastradas ela o ignora (contrato da STC-588), então trocar a chave da
  // busca só para tirá-lo custaria uma requisição a mais, com o mesmo resultado.
  const filtros = useMemo<FiltrosPainelAbsenteismo>(
    () => ({
      rede,
      inicio: periodo.inicio,
      fim: periodo.fim,
      unidade,
      faixa: OPCOES_FAIXA.find((opcao) => opcao.valor === faixa)?.faixas,
      ocorrencia: ocorrencia ? [ocorrencia] : undefined,
      com_pendencias: comPendencias || undefined,
      incluir_desligados: incluirDesligados || undefined,
    }),
    [rede, periodo, unidade, faixa, ocorrencia, comPendencias, incluirDesligados],
  );

  const { painel, carregandoPrimeiraVez, trocandoFiltro, mensagemErro, recarregar } =
    usePainelAbsenteismo(filtros);
  const comFaixas = painel?.parametros.faixas_cadastradas ?? false;

  // Comparativo com o período anterior: segunda busca à mesma rota, com os
  // mesmo filtro de unidade. Faixa, ocorrência e busca ficam de
  // fora porque os cards contam todos; a faixa padrão só enxuga as linhas.
  const [hoje] = useState(hojeISO);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [horasPerdidasAbertas, setHorasPerdidasAbertas] = useState(false);
  const filtrosAnteriores = useMemo<FiltrosPainelAbsenteismo>(
    () => ({
      rede,
      ...periodoAnterior(periodo),
      unidade,
      faixa: ["critica", "atencao"],
    }),
    [rede, periodo, unidade],
  );
  const {
    painel: painelAnterior,
    trocandoFiltro: trocandoAnterior,
    mensagemErro: mensagemErroAnterior,
  } = usePainelAbsenteismo(filtrosAnteriores);
  // Com um dos lados ainda do filtro antigo (ou a busca nova falhou e o SWR
  // mantém a resposta anterior), a diferença misturaria visões.
  const anteriorAtual =
    !trocandoAnterior &&
    !mensagemErroAnterior &&
    painelAnterior?.periodo.inicio === filtrosAnteriores.inicio &&
    painelAnterior.periodo.fim === filtrosAnteriores.fim
      ? painelAnterior
      : undefined;
  const pontos =
    painel && anteriorAtual && !trocandoFiltro
      ? diferencaEmPontos(painel.cards.percentual_periodo, anteriorAtual.cards.percentual_periodo)
      : null;
  const nomeUnidade = unidades.find((item) => item.id === unidade)?.nome;
  const visao = filtroUnidade.mostrar
    ? (nomeUnidade ?? filtroUnidade.rotuloTodas)
    : "Sua unidade";

  const colaboradorAberto = numeroDaUrl(searchParams.get("colaborador"));
  // Card do Kanban (STC-592): origem_url = ?colaborador=&inicio=&fim= do alerta.
  // A linha do painel abre só com ?colaborador=, no período do painel.
  const periodoDoAlerta = periodoDaUrl(searchParams.get("inicio"), searchParams.get("fim"));

  function abrir(linha: LinhaPainelAbsenteismo) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("colaborador", String(linha.colaborador.id));
    params.delete("inicio");
    params.delete("fim");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function fechar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("colaborador");
    params.delete("inicio");
    params.delete("fim");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
  }

  function alternarOrdenacao(campo: CampoOrdenavelAbsenteismo) {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  }

  const { refPai, refTabela, maxHeight } = useAlturaSemLinhaCortada();

  // Atalho dos cards de faixa: a tabela passa a bater com o número do card,
  // que conta a unidade filtrada e ignora os filtros que só
  // afetam as linhas (ocorrência, justificativa pendente e busca). "Incluir
  // desligados" fica como está: ele muda também o número do card. Clicar no
  // card já selecionado volta para o filtro padrão.
  function selecionarFaixa(alvo: FaixaAbsenteismo) {
    setFaixa((atual) => (atual === alvo ? FAIXA_PADRAO : alvo));
    setOcorrencia(undefined);
    setComPendencias(false);
    setBusca("");
    refTabela.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
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

  const ehMobile = useMediaQuery("(max-width: 639px)");
  const temFiltros = Boolean(
    unidade || (comFaixas && faixa) || ocorrencia || comPendencias || incluirDesligados || busca,
  );
  const cards = painel?.cards;

  return (
    <div ref={refPai} className={cn("flex h-full min-h-0 flex-col", ehMobile && "overflow-y-auto")}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-3">
          {/* Só para quem administra as duas redes. */}
          <SeletorRedeGestaoRH />
          <CampoPeriodo
            id="periodo"
            editado={periodoEditado}
            valido={periodoValido}
            onEditar={editarPeriodo}
          />
        </div>
        {cards && (
          <p className="text-[12px] text-muted-foreground">
            {cards.ultima_importacao
              ? `Última importação: ${formatarDataHora(cards.ultima_importacao)}`
              : "Nenhuma importação ainda"}
            {cards.dados_ate && ` · dados até ${formatarDataISO(cards.dados_ate)}`}
            {/* A conta de qualquer período usa os parâmetros de hoje. */}
            {painel?.parametros.vigente_a_partir_de &&
              ` · parâmetros vigentes desde ${formatarDataISO(painel.parametros.vigente_a_partir_de)}`}
          </p>
        )}
      </div>

      {/* Mesma regra do aviso diário aos Admins (STC-692), para todos que
          veem o Painel: os números podem não ter os últimos dias. */}
      {cards?.importacao_parada && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start gap-2.5 rounded-md border border-amber-600/25 bg-amber-600/5 px-3 py-2 text-[12.5px] text-foreground sm:mx-7"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          <span>
            <strong className="font-semibold">Dados desatualizados:</strong>{" "}
            {cards.ultima_importacao
              ? `a última importação do VR Pontomais foi em ${formatarDataISO(cards.ultima_importacao)}.`
              : "nenhuma importação do VR Pontomais foi concluída."}
          </span>
        </div>
      )}

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
            <CardsAbsenteismo
              painel={painel}
              faixaSelecionada={faixa === "critica" || faixa === "atencao" ? faixa : undefined}
              onSelecionarFaixa={selecionarFaixa}
              comparativo={
                pontos !== null && anteriorAtual
                  ? {
                      pontos,
                      nomeAnterior: nomeDoPeriodo(anteriorAtual.periodo, periodo),
                      parcial: periodoEmAndamento(periodo, hoje),
                      minutosAnteriores: anteriorAtual.cards.minutos_ausentes ?? null,
                    }
                  : null
              }
              onAbrirComparativo={() => setComparativoAberto(true)}
              onAbrirHorasPerdidas={() => setHorasPerdidasAbertas(true)}
            />
          </div>

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

            {/* Coordenação e OPEX já recebem só as próprias unidades da API. */}
            {filtroUnidade.mostrar && (
              <Select
                value={unidade ? String(unidade) : "todas"}
                onValueChange={(valor) => setUnidade(valor === "todas" ? undefined : Number(valor))}
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
              Com justificativa pendente
            </label>

            <label
              className="flex h-8 items-center gap-2 rounded-md border border-input px-3 text-[13px] shadow-xs"
              title="Desligados ficam fora da lista e dos cards de faixa. O absenteísmo e as horas perdidas da unidade contam quem trabalhou no período, inclusive desligados."
            >
              <Checkbox
                checked={incluirDesligados}
                onCheckedChange={(valor) => setIncluirDesligados(valor === true)}
              />
              Incluir desligados
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
                  setIncluirDesligados(false);
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
            atualizando={trocandoFiltro}
            onAbrir={abrir}
          />
        </>
      )}

      {/* Montado só aberto: cada abertura começa no ano do período do Painel. */}
      {comparativoAberto && (
        <AbsenteismoMensalModal
          aberto
          onFechar={() => setComparativoAberto(false)}
          anoInicial={Number(periodo.fim.slice(0, 4))}
          hoje={hoje}
          rede={rede}
          unidade={unidade}
          visao={visao}
        />
      )}

      {/* Aberto durante a troca de filtro, mostra os números anteriores
          esmaecidos, como os cards, e se atualiza com a resposta. */}
      {horasPerdidasAbertas && painel?.horas_perdidas && (painel.cards.minutos_ausentes ?? 0) > 0 && (
        <HorasPerdidasModal
          horasPerdidas={painel.horas_perdidas}
          totalMinutos={painel.cards.minutos_ausentes ?? 0}
          // Ano no título quando o período não é do ano de hoje.
          nomeDoPeriodo={nomeDoPeriodo(painel.periodo, { inicio: hoje, fim: hoje })}
          visao={visao}
          atualizando={trocandoFiltro}
          onFechar={() => setHorasPerdidasAbertas(false)}
        />
      )}

      <DetalheColaboradorModal
        colaboradorId={colaboradorAberto}
        periodoEmFoco={null}
        abaInicial="absenteismo"
        periodoAbsenteismo={periodoDoAlerta ?? periodo}
        focarAlertaAbsenteismo={periodoDoAlerta !== null}
        onFechar={fechar}
      />
    </div>
  );
}
