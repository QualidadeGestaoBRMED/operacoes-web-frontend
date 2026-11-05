import api from "./api";
import { formatarDataISO } from "./gestaoRH";
import { ordenarPor, type Ordenacao } from "./ordenacao";
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

// Rotas do colaborador (cabeçalho e férias do modal) sem `?rede=`: o backend
// usa a rede do próprio colaborador (STC-906), qualquer que seja a rede
// escolhida no seletor.
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

export type CampoOrdenavelFerias =
  | "colaborador"
  | "unidade"
  | "periodo"
  | "limite"
  | "proximo_marco"
  | "status";

export type OrdenacaoFerias = Ordenacao<CampoOrdenavelFerias>;

// Datas "AAAA-MM-DD" comparam como texto. Limite vencido vem antes de
// qualquer próximo marco; sem marco nenhum, vai para o fim.
const CHAVES_FERIAS = {
  colaborador: (linha: LinhaPainelFerias) => linha.colaborador.nome,
  unidade: (linha: LinhaPainelFerias) => linha.colaborador.unidade?.nome ?? "",
  periodo: (linha: LinhaPainelFerias) => linha.periodo.inicio_aquisitivo,
  limite: (linha: LinhaPainelFerias) => linha.periodo.limite_concessivo,
  proximo_marco: (linha: LinhaPainelFerias) =>
    linha.limite_vencido_ha_dias !== null ? "0000-00-00" : (linha.proximo_marco?.data ?? null),
  status: (linha: LinhaPainelFerias) => ORDEM_STATUS_PERIODO.indexOf(linha.periodo.status),
};

/** Sem ordenação escolhida, mantém a ordem da API (limite vencido, depois o próximo marco). */
export function ordenarLinhasFerias(
  linhas: LinhaPainelFerias[],
  ordenacao: OrdenacaoFerias | null,
): LinhaPainelFerias[] {
  return ordenarPor(linhas, ordenacao, CHAVES_FERIAS);
}

/** Dias de `de` até `ate` (datas "AAAA-MM-DD"), sem passar por fuso. */
export function diasEntre(de: string, ate: string): number {
  const utc = (iso: string) => {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

/** `iso` menos `dias` (datas "AAAA-MM-DD"), sem passar por fuso. */
export function subtrairDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia - dias)).toISOString().slice(0, 10);
}

/** Aviso do formulário de programar: mesma conta que a API grava (início menos a antecedência da régua). */
export function avisoPrazoSubstituicao(
  inicio: string,
  diasAntes: number,
  hoje: string,
): { texto: string; passou: boolean } {
  const prazo = subtrairDias(inicio, diasAntes);
  const quando =
    diasAntes === 0
      ? "no dia do início das férias"
      : `${textoDias(diasAntes)} antes do início das férias`;
  if (prazo < hoje) {
    return {
      texto: `O prazo para acionar o RH passou em ${formatarDataISO(prazo)} (${quando}). Acione o RH assim que registrar.`,
      passou: true,
    };
  }
  const ate = prazo === hoje ? `hoje, ${formatarDataISO(prazo)}` : formatarDataISO(prazo);
  return { texto: `Acionar o RH até ${ate} (${quando}).`, passou: false };
}

/**
 * Mesmo critério da API ao programar: vencido pelo status ou pela data. Não
 * usar `limite_vencido_ha_dias`, que vem nulo em período programado.
 */
export function limiteJaVencido(
  periodo: { status: StatusPeriodoFerias; limite_concessivo: string },
  hoje: string,
): boolean {
  return periodo.status === "limite_vencido" || periodo.limite_concessivo < hoje;
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
 * Marcos que só atualizaram a demanda aberta por um marco anterior do mesmo
 * período (uma demanda por período: o primeiro marco abre, os seguintes atualizam).
 */
export function marcosQueAtualizaram(marcos: MarcoDoPeriodo[]): Set<MarcoDoPeriodo["tipo"]> {
  const vistas = new Set<number>();
  const atualizaram = new Set<MarcoDoPeriodo["tipo"]>();
  for (const marco of marcos) {
    if (marco.demanda_id === null) continue;
    if (vistas.has(marco.demanda_id)) atualizaram.add(marco.tipo);
    vistas.add(marco.demanda_id);
  }
  return atualizaram;
}

/**
 * Texto abaixo de cada marco no card do período. Com as férias programadas,
 * o motor não dispara mais os marcos do período.
 */
export function textoSituacaoMarco(
  marco: MarcoDoPeriodo,
  hoje: string,
  status: StatusPeriodoFerias,
  atualizouDemanda = false,
): string {
  const demanda = atualizouDemanda ? "demanda atualizada" : "demanda aberta";
  if (marco.tipo === "limite") {
    if (marco.situacao === "vencido") {
      const ha = `vencido há ${textoDias(diasEntre(marco.data, hoje))}`;
      return marco.demanda_id === null
        ? `${ha} · pagamento em dobro`
        : `${ha} · ${demanda} · pagamento em dobro`;
    }
    return "após essa data, pagamento em dobro";
  }
  switch (marco.situacao) {
    case "alerta_gerado":
      return `alerta gerado · ${demanda}`;
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

// regra_gatilho do alerta de férias é o tipo do marco da régua.
const ALERTA_POR_MARCO: Record<string, string> = {
  completou_periodo: "completou o período de direito",
  antes_do_limite: "antes do limite para tirar",
  limite_vencido: "limite para tirar vencido",
};

/** "2025/2026": o período de direito pelos anos de início e fim. */
export function anosDoPeriodo(periodo: { inicio_aquisitivo: string; fim_aquisitivo: string }): string {
  return `${periodo.inicio_aquisitivo.slice(0, 4)}/${periodo.fim_aquisitivo.slice(0, 4)}`;
}

/** Descrição de um registro do histórico de férias, com o período quando a API informa. */
export function textoHistorico(registro: RegistroHistoricoRH): string {
  const texto = descricaoHistorico(registro);
  return registro.periodo ? `${texto} · período ${anosDoPeriodo(registro.periodo)}` : texto;
}

function descricaoHistorico(registro: RegistroHistoricoRH): string {
  const { valor_anterior: anterior, valor_novo: novo } = registro;
  switch (registro.acao) {
    case "periodo_ferias_criado":
      return `Novo período de direito: ${novo}`;
    case "status_periodo_ferias":
      return `Status do período: ${anterior} → ${novo}`;
    case "alerta_ferias_gerado":
      return `Alerta: ${ALERTA_POR_MARCO[registro.regra_gatilho] ?? novo.toLowerCase()}`;
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
    case "alerta_absenteismo_gerado":
      return `Alerta: faixa ${novo.toLowerCase()}`;
    case "tratamento_registrado":
      return `Tratamento registrado: ${novo}`;
    case "alerta_absenteismo_encerrado":
      // regra_gatilho: "saiu_da_faixa" (nova carga) ou "desligamento" (no
      // Django Admin ou pela Jornada do VR).
      return registro.regra_gatilho === "desligamento"
        ? "Alerta encerrado: colaborador desligado"
        : "Alerta encerrado: saiu da faixa na nova carga";
    // Pela importação, quando some da Jornada do VR ou volta a ela (STC-987).
    case "colaborador_desligado_automaticamente":
      return "Desligado automaticamente";
    case "colaborador_reativado_automaticamente":
      return "Reativado automaticamente";
    default:
      return novo || registro.acao;
  }
}
