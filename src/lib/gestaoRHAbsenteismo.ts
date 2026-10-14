import api from "./api";
import { ordenarPor, type Ordenacao } from "./ordenacao";
import { formatarDataISO } from "./gestaoRH";
import type {
  AbsenteismoColaborador,
  AcaoTratamento,
  AlertaAbsenteismo,
  CategoriaPainelAbsenteismo,
  FaixaAbsenteismo,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaAbsenteismo,
  OcorrenciaFiltro,
  PainelAbsenteismo,
  RegistrarTratamentoPayload,
  TipoOcorrenciaAbsenteismo,
} from "@/types/gestaoRH";

const PAINEL_URL = "/modulos/gestao-rh/absenteismo/";

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
  if (ocorrencia.tipo === "atraso" || ocorrencia.tipo === "saida_antecipada") {
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

const FORMATADOR_PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** "13.60" → "13,6%"; nulo (sem dado no período) → "—". */
export function formatarPercentual(valor: string | null): string {
  if (valor === null) return "—";
  return `${FORMATADOR_PERCENTUAL.format(Number(valor))}%`;
}

function contagem(quantidade: number, singular: string, plural: string): string | null {
  return quantidade === 0 ? null : `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Coluna "Ocorrências": ausências que contam (faltas e atestados) e, abaixo,
 * atrasos e saídas antecipadas acima do limite. Só o que aconteceu.
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
  ].filter(Boolean);
  return {
    ausencias: ausencias.length ? ausencias.join(" · ") : null,
    jornada: jornada.length ? jornada.join(" · ") : null,
  };
}

/** Saldo do banco de horas: -220 → "-03:40"; 250 → "+04:10"; 0 → "00:00". */
export function formatarSaldoHoras(minutos: number): string {
  const sinal = minutos > 0 ? "+" : minutos < 0 ? "-" : "";
  const absoluto = Math.abs(minutos);
  const horas = String(Math.floor(absoluto / 60)).padStart(2, "0");
  const resto = String(absoluto % 60).padStart(2, "0");
  return `${sinal}${horas}:${resto}`;
}

/** TMO e Campanha não têm unidade do Atlas: a coluna mostra a equipe do VR. */
export function unidadeOuEquipe(linha: LinhaPainelAbsenteismo): string {
  return linha.colaborador.unidade?.nome ?? linha.equipe;
}

export const OPCOES_CATEGORIA_PAINEL: { valor: CategoriaPainelAbsenteismo; rotulo: string }[] = [
  { valor: "unidade", rotulo: "Unidades" },
  { valor: "tmo", rotulo: "TMO" },
  { valor: "campanha", rotulo: "Campanhas" },
];

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
    linha.faltas + linha.atestados + linha.atrasos_acima_do_limite + linha.saidas_acima_do_limite,
  banco_horas: (linha: LinhaPainelAbsenteismo) => linha.banco_horas_saldo_minutos,
};

/** Sem ordenação escolhida, mantém a ordem da API (maior percentual primeiro). */
export function ordenarLinhasAbsenteismo(
  linhas: LinhaPainelAbsenteismo[],
  ordenacao: OrdenacaoAbsenteismo | null,
): LinhaPainelAbsenteismo[] {
  return ordenarPor(linhas, ordenacao, CHAVES_ABSENTEISMO);
}
