// Dados de exemplo do Painel de Absenteísmo para o ambiente local, enquanto a
// rota real não existe (STC-588). Só é carregado com
// NEXT_PUBLIC_GESTAO_RH_DADOS_EXEMPLO=1 (ver buscarPainelAbsenteismo); fora
// disso, não entra no pacote de produção. Os ids e as unidades são os dos
// colaboradores fictícios do banco local, para o modal abrir de verdade.

import type {
  AbsenteismoColaborador,
  AlertaAbsenteismo,
  ColaboradorResumoRH,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  OcorrenciaAbsenteismo,
  PainelAbsenteismo,
  RegistrarTratamentoPayload,
  RegistroHistoricoRH,
} from "@/types/gestaoRH";

const MACAE = { id: 6, nome: "Macaé" };
const NITEROI = { id: 1, nome: "Niterói" };
const SEDE = { id: 17, nome: "Sede" };
const DUQUE_DE_CAXIAS = { id: 9, nome: "Duque de Caxias" };

function colaborador(
  id: number,
  nome: string,
  matricula_vr: string,
  cargo: string,
  unidade: ColaboradorResumoRH["unidade"],
): ColaboradorResumoRH {
  return { id, nome, matricula_vr, cargo, unidade };
}

function linha(
  dados: ColaboradorResumoRH,
  valores: Partial<LinhaPainelAbsenteismo>,
): LinhaPainelAbsenteismo {
  return {
    colaborador: dados,
    percentual: "0.00",
    faixa: null,
    provisorio: false,
    pendencias: 0,
    dias_trabalhados: 21,
    dias_previstos: 21,
    conformidade_percentual: "100.00",
    faltas: 0,
    atestados: 0,
    afastamentos: 0,
    ausencias: 0,
    atrasos_acima_do_limite: 0,
    saidas_acima_do_limite: 0,
    banco_horas_saldo_minutos: 0,
    banco_horas_uso_minutos: 0,
    demanda_aberta: false,
    ...valores,
  };
}

const LINHAS: LinhaPainelAbsenteismo[] = [
  linha(colaborador(8, "Juliana Ramos", "004512", "Técnica de Enfermagem", NITEROI), {
    percentual: "13.60", faixa: "critica", provisorio: true, pendencias: 2,
    dias_trabalhados: 15, conformidade_percentual: "72.00", faltas: 2, atestados: 1,
    afastamentos: 1, ausencias: 1, atrasos_acima_do_limite: 1, saidas_acima_do_limite: 1,
    banco_horas_saldo_minutos: -220, banco_horas_uso_minutos: 120, demanda_aberta: true,
  }),
  linha(colaborador(2, "Eduardo Pires", "002871", "Técnico de Enfermagem", MACAE), {
    percentual: "10.00", faixa: "critica", dias_trabalhados: 18, dias_previstos: 20,
    conformidade_percentual: "85.00", faltas: 1, atestados: 1, atrasos_acima_do_limite: 1,
    banco_horas_saldo_minutos: 30, demanda_aberta: true,
  }),
  linha(colaborador(7, "Rafael Souza", "002264", "Auxiliar Administrativo", SEDE), {
    percentual: "6.20", faixa: "atencao", provisorio: true, pendencias: 1,
    dias_trabalhados: 20, conformidade_percentual: "90.00", faltas: 1,
    atrasos_acima_do_limite: 2, saidas_acima_do_limite: 2, banco_horas_saldo_minutos: 250,
  }),
  linha(colaborador(6, "Elaine Souza", "002915", "Técnica de Radiologia", MACAE), {
    percentual: "5.90", faixa: "atencao", dias_trabalhados: 20, conformidade_percentual: "88.00",
    atestados: 1, ausencias: 1, atrasos_acima_do_limite: 4, banco_horas_saldo_minutos: -45,
  }),
  linha(colaborador(3, "Leonardo Araújo", "003145", "Enfermeiro", NITEROI), {
    percentual: "4.80", dias_trabalhados: 20, conformidade_percentual: "93.00", faltas: 1,
    atrasos_acima_do_limite: 1, saidas_acima_do_limite: 1, banco_horas_saldo_minutos: 120,
  }),
  linha(colaborador(5, "Gabriela Rocha", "005733", "Recepcionista", DUQUE_DE_CAXIAS), {
    percentual: "2.40", provisorio: true, pendencias: 1, conformidade_percentual: "96.00",
    afastamentos: 2, banco_horas_saldo_minutos: 50,
  }),
  linha(colaborador(4, "Diego Ferreira", "005201", "Auxiliar Administrativo", SEDE), {
    percentual: "0.00", conformidade_percentual: "98.00", saidas_acima_do_limite: 1,
  }),
  linha(colaborador(1, "Marcos Lima", "005977", "Técnico de Enfermagem", MACAE), {
    percentual: null, dias_trabalhados: 0, dias_previstos: 0, conformidade_percentual: null,
  }),
];

const OCORRENCIA_NA_LINHA = {
  falta: (l: LinhaPainelAbsenteismo) => l.faltas > 0,
  atestado: (l: LinhaPainelAbsenteismo) => l.atestados > 0,
  afastamento: (l: LinhaPainelAbsenteismo) => l.afastamentos > 0,
  ausencia: (l: LinhaPainelAbsenteismo) => l.ausencias > 0,
  atraso: (l: LinhaPainelAbsenteismo) => l.atrasos_acima_do_limite > 0,
  saida_antecipada: (l: LinhaPainelAbsenteismo) => l.saidas_acima_do_limite > 0,
};

/** Aplica os filtros como a API vai aplicar: unidade nos cards e nas linhas, o resto só nas linhas. */
export function painelAbsenteismoDeExemplo(filtros: FiltrosPainelAbsenteismo): PainelAbsenteismo {
  const daUnidade = LINHAS.filter(
    (l) => filtros.unidade === undefined || l.colaborador.unidade.id === filtros.unidade,
  );
  const linhas = daUnidade.filter(
    (l) =>
      // Com faixas cadastradas (sempre, nos dados de exemplo) o filtro vale;
      // a API o ignora quando não há faixas.
      (!filtros.faixa?.length || (l.faixa !== null && filtros.faixa.includes(l.faixa))) &&
      (!filtros.ocorrencia?.length ||
        filtros.ocorrencia.some((ocorrencia) => OCORRENCIA_NA_LINHA[ocorrencia](l))) &&
      (!filtros.com_pendencias || l.pendencias > 0),
  );
  const comValor = daUnidade.filter((l) => l.percentual !== null);
  const media =
    comValor.length === 0
      ? null
      : (comValor.reduce((soma, l) => soma + Number(l.percentual), 0) / comValor.length).toFixed(2);
  return {
    periodo: { inicio: filtros.inicio, fim: filtros.fim },
    parametros: { meta_percentual: "5.00", faixas_cadastradas: true, limite_atraso_minutos: 15 },
    cards: {
      percentual_periodo: media,
      faixa_critica: daUnidade.filter((l) => l.faixa === "critica").length,
      faixa_atencao: daUnidade.filter((l) => l.faixa === "atencao").length,
      pendencias: daUnidade.reduce((soma, l) => soma + l.pendencias, 0),
      colaboradores_provisorios: daUnidade.filter((l) => l.provisorio).length,
      colaboradores: daUnidade.length,
      unidades: new Set(daUnidade.map((l) => l.colaborador.unidade.id)).size,
      ultima_importacao: "2026-10-01T08:12:00-03:00",
      dados_ate: "2026-09-30",
    },
    linhas,
  };
}

// Aba Absenteísmo do modal (contrato da STC-592), derivada das mesmas linhas
// do painel: os números do modal batem com os do painel.

const RESPONSAVEL_POR_UNIDADE: Record<number, string> = {
  1: "Coordenação Niterói",
  6: "Coordenação Macaé",
  9: "Coordenação Duque de Caxias",
  17: "Coordenação Sede",
};

// Tratamentos registrados no ambiente local, até recarregar a página, e o
// último período que a aba pediu (o POST devolve a aba nesse período).
const tratamentos = new Map<string, NonNullable<AlertaAbsenteismo["tratamento"]>>();
const ultimoPeriodoConsultado = new Map<number, { inicio: string; fim: string }>();

function dia(periodo: { inicio: string }, deslocamento: number): string {
  const [ano, mes, diaInicial] = periodo.inicio.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, diaInicial + deslocamento));
  return data.toISOString().slice(0, 10);
}

function ocorrencias(
  l: LinhaPainelAbsenteismo,
  periodo: { inicio: string; fim: string },
): OcorrenciaAbsenteismo[] {
  const lista: OcorrenciaAbsenteismo[] = [];
  let deslocamento = 3;
  function ausencia(tipo: OcorrenciaAbsenteismo["tipo"], dias: number, extra = {}) {
    const inicio = dia(periodo, deslocamento);
    lista.push({
      tipo, inicio, fim: dia(periodo, deslocamento + dias - 1), dias, minutos: null,
      conta_no_absenteismo: tipo === "falta" || tipo === "atestado",
      em_aprovacao: false, justificada: tipo === "falta" ? false : null, ...extra,
    });
    deslocamento += dias + 2;
  }
  function minutos(tipo: OcorrenciaAbsenteismo["tipo"], quantidade: number, extra = {}) {
    lista.push({
      tipo, inicio: dia(periodo, deslocamento), fim: dia(periodo, deslocamento), dias: null,
      minutos: quantidade, conta_no_absenteismo: tipo === "banco_horas" ? false : null,
      em_aprovacao: false, justificada: null, ...extra,
    });
    deslocamento += 2;
  }
  for (let i = 0; i < l.faltas; i++) {
    ausencia("falta", 1, i === 1 ? { justificada: true, em_aprovacao: l.provisorio } : {});
  }
  for (let i = 0; i < l.afastamentos; i++) ausencia("afastamento", 2);
  for (let i = 0; i < l.atestados; i++) ausencia("atestado", 1);
  for (let i = 0; i < l.atrasos_acima_do_limite; i++) minutos("atraso", 35 - i * 5);
  for (let i = 0; i < l.ausencias; i++) ausencia("ausencia", 1);
  for (let i = 0; i < l.saidas_acima_do_limite; i++) {
    minutos("saida_antecipada", 20, l.provisorio && i === 0 ? { em_aprovacao: true } : {});
  }
  if (l.banco_horas_uso_minutos > 0) minutos("banco_horas", l.banco_horas_uso_minutos);
  return lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function absenteismoColaboradorDeExemplo(
  colaboradorId: number,
  periodo: { inicio: string; fim: string },
): AbsenteismoColaborador {
  ultimoPeriodoConsultado.set(colaboradorId, periodo);
  const l = LINHAS.find((item) => item.colaborador.id === colaboradorId);
  const chave = `${colaboradorId}-${periodo.inicio}-${periodo.fim}`;
  const tratamento = tratamentos.get(chave) ?? null;
  const alertas: AlertaAbsenteismo[] =
    l?.faixa === "critica"
      ? [
          {
            id: colaboradorId * 100,
            periodo_inicio: periodo.inicio,
            periodo_fim: periodo.fim,
            faixa: "critica",
            gerado_em: `${dia({ inicio: periodo.fim }, 1)}T06:00:00-03:00`,
            demanda_id: colaboradorId * 1000,
            demanda_aberta: tratamento === null,
            responsavel: RESPONSAVEL_POR_UNIDADE[l.colaborador.unidade.id] ?? null,
            pode_registrar_tratamento: tratamento === null,
            tratamento,
          },
        ]
      : [];
  const historico: RegistroHistoricoRH[] = [];
  if (tratamento) {
    historico.push({
      acao: "tratamento_registrado", valor_anterior: "", valor_novo: tratamento.acao,
      justificativa: tratamento.justificativa, regra_gatilho: "", por: tratamento.por,
      automatico: false, em: tratamento.em,
    });
  }
  for (const alerta of alertas) {
    historico.push({
      acao: "alerta_absenteismo_gerado", valor_anterior: "", valor_novo: "Crítica",
      justificativa: "", regra_gatilho: "faixa_critica", por: null, automatico: true,
      em: alerta.gerado_em,
    });
  }
  return {
    periodo,
    parametros: { faixas_cadastradas: true, limite_atraso_minutos: 15 },
    indicadores: {
      percentual: l?.percentual ?? null,
      faixa: l?.faixa ?? null,
      provisorio: l?.provisorio ?? false,
      pendencias: l?.pendencias ?? 0,
      dias_trabalhados: l?.dias_trabalhados ?? 0,
      dias_previstos: l?.dias_previstos ?? 0,
      conformidade_percentual: l?.conformidade_percentual ?? null,
      banco_horas_saldo_minutos: l?.banco_horas_saldo_minutos ?? 0,
      banco_horas_uso_minutos: l?.banco_horas_uso_minutos ?? 0,
    },
    ocorrencias: l ? ocorrencias(l, periodo) : [],
    alertas,
    historico,
  };
}

export function registrarTratamentoDeExemplo(
  colaboradorId: number,
  payload: RegistrarTratamentoPayload,
): AbsenteismoColaborador {
  // O id do alerta de exemplo é colaborador × 100 e o período é o que a aba
  // pediu; para devolver a aba, basta reaproveitar a última consulta dela.
  const periodo = ultimoPeriodoConsultado.get(colaboradorId);
  if (!periodo || payload.alerta !== colaboradorId * 100) {
    throw new Error("Alerta de exemplo não encontrado.");
  }
  tratamentos.set(`${colaboradorId}-${periodo.inicio}-${periodo.fim}`, {
    acao: payload.acao,
    justificativa: payload.justificativa,
    por: "Você (dados de exemplo)",
    em: new Date().toISOString(),
  });
  return absenteismoColaboradorDeExemplo(colaboradorId, periodo);
}
