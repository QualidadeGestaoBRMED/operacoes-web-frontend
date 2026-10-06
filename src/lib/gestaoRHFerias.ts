import api from "./api";
import { formatarDataISO } from "./gestaoRH";
import type {
  CabecalhoColaborador,
  FeriasColaborador,
  FiltrosPainelFerias,
  LinhaPainelFerias,
  MarcoDoPeriodo,
  PainelFerias,
  ProgramacaoFerias,
  ProgramarFeriasPayload,
  RegistroHistoricoRH,
  StatusPeriodoFerias,
  TipoProximoMarco,
} from "@/types/gestaoRH";

const MODULO_URL = "/modulos/gestao-rh/";

export async function buscarPainelFerias(filtros: FiltrosPainelFerias): Promise<PainelFerias> {
  const { data } = await api.get<PainelFerias>(`${MODULO_URL}ferias/`, { params: filtros });
  return data;
}

export async function buscarColaboradorRH(id: number): Promise<CabecalhoColaborador> {
  const { data } = await api.get<CabecalhoColaborador>(`${MODULO_URL}colaboradores/${id}/`);
  return data;
}

export async function buscarFeriasColaborador(id: number): Promise<FeriasColaborador> {
  const { data } = await api.get<FeriasColaborador>(`${MODULO_URL}colaboradores/${id}/ferias/`);
  return data;
}

// As três ações devolvem a aba Férias do colaborador já atualizada.

export async function programarFerias(
  periodoId: number,
  payload: ProgramarFeriasPayload,
): Promise<FeriasColaborador> {
  const { data } = await api.patch<FeriasColaborador>(`${MODULO_URL}ferias/${periodoId}/`, {
    acao: "programar",
    ...payload,
  });
  return data;
}

export async function adiarProgramacao(
  periodoId: number,
  justificativa: string,
): Promise<FeriasColaborador> {
  const { data } = await api.patch<FeriasColaborador>(`${MODULO_URL}ferias/${periodoId}/`, {
    acao: "adiar",
    justificativa,
  });
  return data;
}

export async function registrarRhAcionado(periodoId: number): Promise<FeriasColaborador> {
  const { data } = await api.post<FeriasColaborador>(
    `${MODULO_URL}ferias/${periodoId}/rh-acionado/`,
  );
  return data;
}

export const ROTULO_STATUS_PERIODO: Record<StatusPeriodoFerias, string> = {
  pendente: "Pendente",
  programado: "Programado",
  programacao_adiada: "Programação adiada",
  ferias_tiradas: "Férias tiradas",
  limite_vencido: "Limite vencido",
};

export const ORDEM_STATUS_PERIODO: StatusPeriodoFerias[] = [
  "limite_vencido",
  "pendente",
  "programacao_adiada",
  "programado",
];

// Mesmo semáforo dos badges de status da Legalização (fundo sólido, texto branco).
export const COR_STATUS_PERIODO: Record<StatusPeriodoFerias, string> = {
  limite_vencido: "bg-red-600",
  pendente: "bg-amber-600",
  programacao_adiada: "bg-slate-500",
  programado: "bg-cyan-700",
  ferias_tiradas: "bg-green-600",
};

export const JANELAS_PAINEL = [30, 60, 90, 180] as const;
export const JANELA_PADRAO = 90;

const ROTULO_PROXIMO_MARCO: Record<TipoProximoMarco, string> = {
  completou_periodo: "Completou o período de direito",
  antes_do_limite: "Antes do limite para tirar",
  limite: "Limite para tirar",
  acionar_rh: "Acionar o RH até",
  inicio_ferias: "Início das férias",
};

/** Dias de `de` até `ate` (datas "AAAA-MM-DD"), sem passar por fuso. */
export function diasEntre(de: string, ate: string): number {
  const utc = (iso: string) => {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

/** "05/10/2026 a 04/10/2027". */
export function intervalo(inicio: string, fim: string): string {
  return `${formatarDataISO(inicio)} a ${formatarDataISO(fim)}`;
}

/** "23/11 a 22/12": férias cabem no mesmo ano ou viram o ano, o dia e o mês bastam na tabela. */
function intervaloCurto(inicio: string, fim: string): string {
  return `${formatarDataISO(inicio).slice(0, 5)} a ${formatarDataISO(fim).slice(0, 5)}`;
}

function plural(quantidade: number, singular: string, plural: string) {
  return quantidade === 1 ? singular : plural;
}

export function textoDias(dias: number): string {
  return `${dias} ${plural(dias, "dia", "dias")}`;
}

/** Coluna "Próximo marco" do painel: o evento e, abaixo, a data ou o atraso. */
export function partesProximoMarco(
  linha: LinhaPainelFerias,
  hoje: string,
): { titulo: string; detalhe: string | null } {
  if (linha.limite_vencido_ha_dias !== null) {
    return {
      titulo: "Nenhum",
      detalhe: `limite vencido há ${textoDias(linha.limite_vencido_ha_dias)}`,
    };
  }
  const marco = linha.proximo_marco;
  if (!marco) return { titulo: "Nenhum", detalhe: null };
  const data = formatarDataISO(marco.data);
  if (marco.tipo === "limite") {
    const faltam = diasEntre(hoje, marco.data);
    return { titulo: faltam === 0 ? "Limite hoje" : `Limite em ${textoDias(faltam)}`, detalhe: data };
  }
  return { titulo: ROTULO_PROXIMO_MARCO[marco.tipo], detalhe: data };
}

export function textoProximoMarco(linha: LinhaPainelFerias, hoje: string): string {
  const { titulo, detalhe } = partesProximoMarco(linha, hoje);
  return detalhe ? `${titulo} · ${detalhe}` : titulo;
}

export function textoProgramacao(programacao: ProgramacaoFerias, { curto = false } = {}): string {
  const datas = curto
    ? intervaloCurto(programacao.data_inicio, programacao.data_fim)
    : intervalo(programacao.data_inicio, programacao.data_fim);
  const substituicao = programacao.necessita_substituicao
    ? "com substituição"
    : "sem substituição";
  return `Férias ${datas} · ${substituicao}`;
}

/** Coluna "Situação": a programação, o adiamento ou as demandas abertas. */
export function textoSituacao(linha: LinhaPainelFerias): string {
  if (linha.programacao && linha.periodo.status === "programado") {
    return textoProgramacao(linha.programacao, { curto: true });
  }
  if (linha.periodo.status === "programacao_adiada") return "Adiada · justificativa registrada";
  if (linha.demandas_abertas > 0) {
    return linha.demandas_abertas === 1
      ? "Demanda aberta"
      : `${linha.demandas_abertas} demandas abertas`;
  }
  return "Sem demanda aberta";
}

/**
 * Texto abaixo de cada marco no card do período. Com as férias programadas,
 * o motor não dispara mais os marcos do período.
 */
export function textoSituacaoMarco(
  marco: MarcoDoPeriodo,
  hoje: string,
  status: StatusPeriodoFerias,
): string {
  if (marco.tipo === "limite") {
    if (marco.situacao === "vencido") {
      return `vencido há ${textoDias(diasEntre(marco.data, hoje))} · pagamento em dobro`;
    }
    return "após essa data, pagamento em dobro";
  }
  switch (marco.situacao) {
    case "alerta_gerado":
      return "alerta gerado · demanda aberta";
    case "tratado":
      return "alerta gerado · tratado";
    case "proximo":
      return status === "programado" ? "sem alerta: férias programadas" : "próximo alerta";
    case "futuro":
      return status === "programado" ? "sem alerta: férias programadas" : "alerta futuro";
    case "sem_alerta":
      return "sem alerta (anterior ao cadastro do período)";
    default:
      return "";
  }
}

export const ROTULO_MARCO_DO_PERIODO: Record<MarcoDoPeriodo["tipo"], string> = {
  completou_periodo: "Completou o período de direito",
  antes_do_limite: "Antes do limite para tirar",
  limite: "Limite para tirar",
};

/** Descrição de um registro do histórico de férias. */
export function textoHistorico(registro: RegistroHistoricoRH): string {
  const { valor_anterior: anterior, valor_novo: novo } = registro;
  switch (registro.acao) {
    case "periodo_ferias_criado":
      return `Novo período de direito: ${novo}`;
    case "status_periodo_ferias":
      return `Status do período: ${anterior} → ${novo}`;
    case "alerta_ferias_gerado":
      return `Alerta: ${novo.charAt(0).toLowerCase()}${novo.slice(1)}`;
    case "alerta_substituicao_gerado":
      return `Alerta: acionar o RH para as férias de ${novo}`;
    case "demanda_transferida":
      return `Demanda transferida de ${anterior} para ${novo}`;
    case "programacao_registrada":
      return `Férias programadas: ${novo}`;
    case "programacao_adiada":
      return "Programação adiada, com justificativa";
    case "rh_acionado":
      return `RH acionado para as ${novo}`;
    default:
      return novo || registro.acao;
  }
}
