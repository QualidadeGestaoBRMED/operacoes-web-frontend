import api from "./api";
import { ordenarPor, type Ordenacao } from "./ordenacao";
import type {
  FaixaAbsenteismo,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaFiltro,
  PainelAbsenteismo,
} from "@/types/gestaoRH";

const PAINEL_URL = "/modulos/gestao-rh/absenteismo/";

/**
 * Painel de Absenteísmo. Com `NEXT_PUBLIC_GESTAO_RH_DADOS_EXEMPLO=1` (só no
 * ambiente local, enquanto a rota real não existe, STC-588), devolve dados de
 * exemplo no mesmo contrato. A variável é fixada no build: sem ela, o
 * módulo de exemplo nem entra no pacote de produção.
 */
export async function buscarPainelAbsenteismo(
  filtros: FiltrosPainelAbsenteismo,
): Promise<PainelAbsenteismo> {
  if (process.env.NEXT_PUBLIC_GESTAO_RH_DADOS_EXEMPLO === "1") {
    const { painelAbsenteismoDeExemplo } = await import("./gestaoRHAbsenteismoExemplo");
    return painelAbsenteismoDeExemplo(filtros);
  }
  const { data } = await api.get<PainelAbsenteismo>(PAINEL_URL, {
    params: filtros,
    // Filtros que repetem (faixa, ocorrencia) vão como `faixa=a&faixa=b`, o formato do DRF.
    paramsSerializer: { indexes: null },
  });
  return data;
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
  ausencia: "Ausência",
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
  unidade: (linha: LinhaPainelAbsenteismo) => linha.colaborador.unidade.nome,
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
