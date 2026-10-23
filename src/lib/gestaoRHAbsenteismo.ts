import api from "./api";
import { ordenarPor, type Ordenacao } from "./ordenacao";
import { formatarDataISO } from "./gestaoRH";
import type {
  AbsenteismoColaborador,
  AbsenteismoMensal,
  AcaoTratamento,
  AlertaAbsenteismo,
  FaixaAbsenteismo,
  FiltrosAbsenteismoMensal,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaAbsenteismo,
  OcorrenciaFiltro,
  PainelAbsenteismo,
  RegistrarTratamentoPayload,
  TipoOcorrenciaAbsenteismo,
  TipoDeAusencia,
} from "@/types/gestaoRH";

const PAINEL_URL = "/modulos/gestao-rh/absenteismo/";
const MENSAL_URL = "/modulos/gestao-rh/absenteismo/mensal/";

/** Absenteísmo mês a mês de um ano (rota da STC-748). */
export async function buscarAbsenteismoMensal(
  filtros: FiltrosAbsenteismoMensal,
): Promise<AbsenteismoMensal> {
  const { data } = await api.get<AbsenteismoMensal>(MENSAL_URL, { params: filtros });
  return data;
}

/** Painel de Absenteísmo (rota da STC-588). */
export async function buscarPainelAbsenteismo(
  filtros: FiltrosPainelAbsenteismo,
): Promise<PainelAbsenteismo> {
  const { data } = await api.get<PainelAbsenteismo>(PAINEL_URL, {
    params: filtros,
    // Filtros que repetem (faixa, ocorrencia) vão como `faixa=a&faixa=b`, o formato do DRF.
    paramsSerializer: { indexes: null },
  });
  return data;
}

const COLABORADORES_URL = "/modulos/gestao-rh/colaboradores/";

/** Aba Absenteísmo do modal (contrato da STC-592). */
export async function buscarAbsenteismoColaborador(
  colaboradorId: number,
  periodo: { inicio: string; fim: string },
): Promise<AbsenteismoColaborador> {
  const { data } = await api.get<AbsenteismoColaborador>(
    `${COLABORADORES_URL}${colaboradorId}/absenteismo/`,
    { params: periodo },
  );
  return data;
}

/** Registra o tratamento do alerta; devolve a aba já atualizada, no período do alerta. */
export async function registrarTratamento(
  colaboradorId: number,
  payload: RegistrarTratamentoPayload,
): Promise<AbsenteismoColaborador> {
  const { data } = await api.post<AbsenteismoColaborador>(
    `${COLABORADORES_URL}${colaboradorId}/tratamentos/`,
    payload,
  );
  return data;
}

export const ROTULO_ACAO_TRATAMENTO: Record<AcaoTratamento, string> = {
  feedback: "Feedback",
  advertencia: "Advertência",
  desligamento: "Desligamento",
  sem_medida: "Sem medida (situação justificada)",
};

export const ACOES_TRATAMENTO = Object.keys(ROTULO_ACAO_TRATAMENTO) as AcaoTratamento[];

const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrenciaAbsenteismo, string> = {
  falta: "Falta",
  atestado: "Atestado",
  afastamento: "Afastamento",
  ausencia: "Ausência justificada",
  atraso: "Atraso",
  saida_antecipada: "Saída antecipada",
  jornada_incompleta: "Jornada incompleta",
  banco_horas: "Banco de horas",
};

function datasDaOcorrencia(ocorrencia: OcorrenciaAbsenteismo): string {
  return ocorrencia.inicio === ocorrencia.fim
    ? formatarDataISO(ocorrencia.inicio)
    : `${formatarDataISO(ocorrencia.inicio)} a ${formatarDataISO(ocorrencia.fim)}`;
}

function textoMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}

/**
 * Linha de ocorrência da aba: "04/08/2026 · Falta sem justificativa" e as
 * marcas ao lado ("conta no absenteísmo", "pendente no VR", "acima de 15 min").
 */
export function textoOcorrencia(
  ocorrencia: OcorrenciaAbsenteismo,
  limiteMinutos: number,
): { datas: string; descricao: string; marcas: string[] } {
  const rotulo = ROTULO_TIPO_OCORRENCIA[ocorrencia.tipo];
  let descricao = rotulo;
  if (ocorrencia.tipo === "falta" && ocorrencia.em_aprovacao) {
    // Justificativa enviada e ainda não aprovada no SuperApp VR: não está resolvida.
    descricao = "Falta com justificativa";
  } else if (ocorrencia.tipo === "falta" && ocorrencia.justificada !== null) {
    descricao = ocorrencia.justificada ? "Falta justificada" : "Falta sem justificativa";
  } else if (ocorrencia.minutos !== null && ocorrencia.tipo !== "banco_horas") {
    descricao = `${rotulo} de ${textoMinutos(ocorrencia.minutos)}`;
  } else if (ocorrencia.minutos !== null) {
    descricao = `${rotulo} · ${textoMinutos(ocorrencia.minutos)}`;
  } else if (ocorrencia.dias !== null && ocorrencia.dias > 1) {
    descricao = `${rotulo} · ${ocorrencia.dias} dias`;
  }

  const marcas: string[] = [];
  if (
    ocorrencia.tipo === "atraso" ||
    ocorrencia.tipo === "saida_antecipada" ||
    ocorrencia.tipo === "jornada_incompleta"
  ) {
    marcas.push(`acima de ${limiteMinutos} min`);
  } else if (ocorrencia.conta_no_absenteismo !== null) {
    marcas.push(ocorrencia.conta_no_absenteismo ? "conta no absenteísmo" : "não conta no absenteísmo");
  }
  if (ocorrencia.em_aprovacao) marcas.push("pendente no VR");
  return { datas: datasDaOcorrencia(ocorrencia), descricao, marcas };
}

const FORMATADOR_MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Alerta de agosto/2026" para o mês fechado; senão, "Alerta de 01/08/2026 a 15/08/2026". */
export function tituloAlerta(alerta: AlertaAbsenteismo): string {
  const [ano, mes] = alerta.periodo_inicio.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesInteiro =
    alerta.periodo_inicio.endsWith("-01") &&
    alerta.periodo_fim === `${alerta.periodo_inicio.slice(0, 8)}${String(ultimoDia).padStart(2, "0")}`;
  if (!mesInteiro) {
    return `Alerta de ${formatarDataISO(alerta.periodo_inicio)} a ${formatarDataISO(alerta.periodo_fim)}`;
  }
  const nome = FORMATADOR_MES.format(new Date(Date.UTC(ano, mes - 1, 1))).replace(" de ", "/");
  return `Alerta de ${nome}`;
}

export const ROTULO_FAIXA: Record<FaixaAbsenteismo, string> = {
  critica: "Crítica",
  atencao: "Atenção",
};

export const COR_FAIXA: Record<FaixaAbsenteismo, string> = {
  critica: "bg-red-600",
  atencao: "bg-amber-600",
};

export const ROTULO_OCORRENCIA: Record<OcorrenciaFiltro, string> = {
  falta: "Falta",
  atestado: "Atestado",
  afastamento: "Afastamento",
  ausencia: "Ausência justificada",
  atraso: "Atraso",
  saida_antecipada: "Saída antecipada",
  jornada_incompleta: "Jornada incompleta",
};

export const OCORRENCIAS_FILTRO = Object.keys(ROTULO_OCORRENCIA) as OcorrenciaFiltro[];

/** Período padrão do painel: o mês anterior fechado, a partir de hoje ("AAAA-MM-DD"). */
export function mesAnteriorFechado(hoje: string): { inicio: string; fim: string } {
  const [ano, mes] = hoje.split("-").map(Number);
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const ultimoDia = new Date(Date.UTC(anoAnterior, mesAnterior, 0)).getUTCDate();
  const prefixo = `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}`;
  return { inicio: `${prefixo}-01`, fim: `${prefixo}-${String(ultimoDia).padStart(2, "0")}` };
}

export interface PeriodoAbsenteismo {
  inicio: string;
  fim: string;
}

function dataUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function isoUTC(data: Date): string {
  return data.toISOString().slice(0, 10);
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Do dia 1 ao último dia do mesmo mês. */
export function ehMesInteiro({ inicio, fim }: PeriodoAbsenteismo): boolean {
  const [ano, mes] = inicio.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return inicio.endsWith("-01") && fim === `${inicio.slice(0, 8)}${String(ultimoDia).padStart(2, "0")}`;
}

/**
 * Período do comparativo: mês inteiro compara com o mês inteiro anterior
 * (meses têm tamanhos diferentes); qualquer outro período, com o mesmo
 * número de dias logo antes dele.
 */
export function periodoAnterior(periodo: PeriodoAbsenteismo): PeriodoAbsenteismo {
  if (ehMesInteiro(periodo)) {
    const [ano, mes] = periodo.inicio.split("-").map(Number);
    return mesAnteriorFechado(`${ano}-${String(mes).padStart(2, "0")}-01`);
  }
  const inicio = dataUTC(periodo.inicio);
  const dias = Math.round((dataUTC(periodo.fim).getTime() - inicio.getTime()) / UM_DIA_MS) + 1;
  const fimAnterior = new Date(inicio.getTime() - UM_DIA_MS);
  return {
    inicio: isoUTC(new Date(fimAnterior.getTime() - (dias - 1) * UM_DIA_MS)),
    fim: isoUTC(fimAnterior),
  };
}

/** O fim ainda não passou: os números do período vão mudar. */
export function periodoEmAndamento({ fim }: PeriodoAbsenteismo, hoje: string): boolean {
  return fim >= hoje;
}

const FORMATADOR_NOME_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/**
 * Nome curto do período: "agosto" para mês inteiro ("dezembro/2025" quando o
 * ano é outro que o de `referencia`), senão as datas ("30/09 a 06/10").
 */
export function nomeDoPeriodo(periodo: PeriodoAbsenteismo, referencia: PeriodoAbsenteismo): string {
  if (ehMesInteiro(periodo)) {
    const nome = FORMATADOR_NOME_MES.format(dataUTC(periodo.inicio));
    const ano = periodo.inicio.slice(0, 4);
    return ano === referencia.inicio.slice(0, 4) ? nome : `${nome}/${ano}`;
  }
  const curta = (iso: string) => formatarDataISO(iso).slice(0, 5);
  return `${curta(periodo.inicio)} a ${curta(periodo.fim)}`;
}

const FORMATADOR_MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

/** "jan", "fev"... (sem o ponto do formato abreviado). */
export function nomeCurtoDoMes(mes: number): string {
  return FORMATADOR_MES_CURTO.format(new Date(Date.UTC(2026, mes - 1, 1))).replace(".", "");
}

/**
 * Meses por extenso, com as sequências agrupadas: [1..8, 11, 12] →
 * "jan a ago, nov e dez"; três ou mais seguidos viram "a".
 */
export function mesesPorExtenso(meses: number[]): string {
  const grupos: number[][] = [];
  for (const mes of [...meses].sort((a, b) => a - b)) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.at(-1) === mes - 1) ultimo.push(mes);
    else grupos.push([mes]);
  }
  const partes = grupos.flatMap((grupo) =>
    grupo.length >= 3
      ? [`${nomeCurtoDoMes(grupo[0])} a ${nomeCurtoDoMes(grupo.at(-1)!)}`]
      : grupo.map(nomeCurtoDoMes),
  );
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** Diferença em pontos percentuais, com uma casa; nula sem percentual em um dos lados. */
export function diferencaEmPontos(atual: string | null, anterior: string | null): number | null {
  if (atual === null || anterior === null) return null;
  // Em centésimos inteiros (a API manda duas casas): sem erro de ponto
  // flutuante, e a meia casa arredonda para longe do zero nos dois sentidos.
  const centesimos = Math.round(Number(atual) * 100) - Math.round(Number(anterior) * 100);
  // `|| 0`: -0,04 arredonda para -0, que deve aparecer como sem variação.
  return (Math.sign(centesimos) * Math.round(Math.abs(centesimos) / 10)) / 10 || 0;
}

const FORMATADOR_PONTOS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/**
 * "▲ +0,4 p.p.", "▼ −1,2 p.p." ou "sem variação". Pontos percentuais, não
 * porcentagem: de 3,2% para 4% são +0,8 p.p. (em porcentagem, +25%).
 */
export function formatarDiferenca(pontos: number): string {
  if (pontos === 0) return "sem variação";
  const valor = FORMATADOR_PONTOS.format(Math.abs(pontos));
  return pontos > 0 ? `▲ +${valor} p.p.` : `▼ −${valor} p.p.`;
}

/** Dica da variação, para quem não conhece "p.p.". */
export const DICA_PONTOS_PERCENTUAIS =
  "Diferença em pontos percentuais: de 3,2% para 4% são +0,8 p.p.";

/** Subir o absenteísmo é piorar: vermelho; cair é melhorar: verde. */
export function corDaDiferenca(pontos: number): string {
  if (pontos > 0) return "text-red-600";
  if (pontos < 0) return "text-emerald-700";
  return "text-muted-foreground";
}

const FORMATADOR_PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** "13.60" → "13,6%"; nulo (sem dado no período) → "—". */
/**
 * Limite da linha tracejada do mês a mês: o da versão dos parâmetros usada
 * na conta, a mesma para todos os meses (`parametros`, STC-766). Sem
 * `parametros` (backend anterior), o do último mês com dado.
 */
export function limiteDoMensal(mensal: AbsenteismoMensal | undefined): string | null {
  if (!mensal) return null;
  if (mensal.parametros) return mensal.parametros.meta_percentual;
  const ultimoComDado = mensal.meses.findLast((mes) => !mes.futuro && mes.percentual_periodo !== null);
  return ultimoComDado?.meta_percentual ?? null;
}

export function formatarPercentual(valor: string | null): string {
  if (valor === null) return "—";
  return `${FORMATADOR_PERCENTUAL.format(Number(valor))}%`;
}

// Sem a contagem (campo ausente, ex.: backend anterior a jornadas_incompletas), não mostra.
function contagem(quantidade: number | undefined, singular: string, plural: string): string | null {
  return !quantidade ? null : `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Coluna "Ocorrências": ausências que contam (faltas e atestados) e, abaixo,
 * atrasos, saídas antecipadas e jornadas incompletas (turno variável) acima
 * do limite. Só o que aconteceu.
 */
export function textoOcorrencias(linha: LinhaPainelAbsenteismo): {
  ausencias: string | null;
  jornada: string | null;
} {
  const ausencias = [
    contagem(linha.faltas, "falta", "faltas"),
    contagem(linha.atestados, "atestado", "atestados"),
  ].filter(Boolean);
  const jornada = [
    contagem(linha.atrasos_acima_do_limite, "atraso", "atrasos"),
    contagem(linha.saidas_acima_do_limite, "saída antecipada", "saídas antecipadas"),
    contagem(linha.jornadas_incompletas, "jornada incompleta", "jornadas incompletas"),
  ].filter(Boolean);
  return {
    ausencias: ausencias.length ? ausencias.join(" · ") : null,
    jornada: jornada.length ? jornada.join(" · ") : null,
  };
}

export type LadoDaAusencia = "injustificado" | "justificado";

/** Nome e lado de cada tipo de ausência que conta nas horas perdidas (STC-868). */
export const TIPO_DE_AUSENCIA: Record<TipoDeAusencia, { rotulo: string; lado: LadoDaAusencia }> = {
  falta: { rotulo: "Faltas", lado: "injustificado" },
  atraso: { rotulo: "Atrasos", lado: "injustificado" },
  saida_antecipada: { rotulo: "Saídas antecipadas", lado: "injustificado" },
  jornada_incompleta: { rotulo: "Jornadas incompletas", lado: "injustificado" },
  atestado: { rotulo: "Atestados", lado: "justificado" },
  ausencia: { rotulo: "Ausências justificadas", lado: "justificado" },
};

/**
 * Parte de um total, em % inteiro: "33%". Nas pontas, "menos de 1%" e
 * "mais de 99%" quando o arredondamento esconderia o resto.
 */
export function percentualDoTotal(minutos: number, total: number): string {
  if (total <= 0) return "0%";
  const percentual = Math.round((minutos / total) * 100);
  if (minutos > 0 && percentual === 0) return "menos de 1%";
  if (minutos < total && percentual === 100) return "mais de 99%";
  return `${percentual}%`;
}

/**
 * Nome e cor de cada lado, na paleta dos gráficos de Horas Extras (teal e
 * âmbar): config do `ChartContainer` e marca da legenda.
 */
export const CONFIG_DO_GRAFICO_DE_AUSENCIAS = {
  injustificado: { label: "Injustificado", color: "var(--chart-4)" },
  justificado: { label: "Justificado", color: "var(--secondary)" },
} as const satisfies Record<LadoDaAusencia, { label: string; color: string }>;

export interface ComposicaoDasAusencias {
  totalMinutos: number;
  partes: { lado: LadoDaAusencia; minutos: number; percentual: number }[];
}

/**
 * Justificado × injustificado dos minutos que contam no percentual
 * (STC-840): injustificado primeiro. Os percentuais somam 100. Sem ausência
 * no período, ou sem os campos (backend anterior), null.
 */
export function composicaoDasAusencias(indicadores: {
  minutos_justificados?: number;
  minutos_injustificados?: number;
}): ComposicaoDasAusencias | null {
  const justificado = indicadores.minutos_justificados;
  const injustificado = indicadores.minutos_injustificados;
  if (justificado === undefined || injustificado === undefined) return null;
  const totalMinutos = justificado + injustificado;
  if (totalMinutos <= 0) return null;
  const percentualInjustificado = Math.round((injustificado / totalMinutos) * 100);
  return {
    totalMinutos,
    partes: [
      { lado: "injustificado", minutos: injustificado, percentual: percentualInjustificado },
      { lado: "justificado", minutos: justificado, percentual: 100 - percentualInjustificado },
    ],
  };
}

/**
 * Percentual de um lado da composição. Nas pontas não arredonda para 0% nem
 * para 100% quando o outro lado também tem minutos, como as horas extras
 * por fator.
 */
export function textoDoPercentualDoLado(
  parte: ComposicaoDasAusencias["partes"][number],
  totalMinutos: number,
): string {
  if (parte.minutos > 0 && parte.percentual === 0) return "menos de 1%";
  if (parte.minutos < totalMinutos && parte.percentual === 100) return "mais de 99%";
  return `${parte.percentual}%`;
}

/** Saldo do banco de horas: -220 → "-03:40"; 250 → "+04:10"; 0 → "00:00". */
export function formatarSaldoHoras(minutos: number): string {
  const sinal = minutos > 0 ? "+" : minutos < 0 ? "-" : "";
  const absoluto = Math.abs(minutos);
  const horas = String(Math.floor(absoluto / 60)).padStart(2, "0");
  const resto = String(absoluto % 60).padStart(2, "0");
  return `${sinal}${horas}:${resto}`;
}

/** Colaborador ainda sem unidade do Atlas: a coluna mostra a equipe do VR. */
export function unidadeOuEquipe(linha: Pick<LinhaPainelAbsenteismo, "colaborador" | "equipe">): string {
  return linha.colaborador.unidade?.nome ?? linha.equipe;
}

export type CampoOrdenavelAbsenteismo =
  | "colaborador"
  | "unidade"
  | "percentual"
  | "dias_trabalhados"
  | "conformidade"
  | "ocorrencias"
  | "banco_horas";

export type OrdenacaoAbsenteismo = Ordenacao<CampoOrdenavelAbsenteismo>;

const CHAVES_ABSENTEISMO = {
  colaborador: (linha: LinhaPainelAbsenteismo) => linha.colaborador.nome,
  unidade: (linha: LinhaPainelAbsenteismo) => unidadeOuEquipe(linha),
  percentual: (linha: LinhaPainelAbsenteismo) =>
    linha.percentual === null ? null : Number(linha.percentual),
  dias_trabalhados: (linha: LinhaPainelAbsenteismo) => linha.dias_trabalhados,
  conformidade: (linha: LinhaPainelAbsenteismo) =>
    linha.conformidade_percentual === null ? null : Number(linha.conformidade_percentual),
  ocorrencias: (linha: LinhaPainelAbsenteismo) =>
    linha.faltas +
    linha.atestados +
    linha.atrasos_acima_do_limite +
    linha.saidas_acima_do_limite +
    (linha.jornadas_incompletas ?? 0),
  banco_horas: (linha: LinhaPainelAbsenteismo) => linha.banco_horas_saldo_minutos,
};

/** Sem ordenação escolhida, mantém a ordem da API (maior percentual primeiro). */
export function ordenarLinhasAbsenteismo(
  linhas: LinhaPainelAbsenteismo[],
  ordenacao: OrdenacaoAbsenteismo | null,
): LinhaPainelAbsenteismo[] {
  return ordenarPor(linhas, ordenacao, CHAVES_ABSENTEISMO);
}

/** Dica do card de horas perdidas: o que entra e o que não é. */
export const DICA_HORAS_PERDIDAS =
  "Ausências que contam no absenteísmo: faltas e atestados (conforme os parâmetros), atrasos e saídas acima do limite, de quem trabalhou no período, inclusive desligados. São horas, não valor em reais.";
