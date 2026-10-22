// Linhas de exemplo do Painel de Absenteísmo para os testes, no contrato
// da STC-588. Os ids e as unidades são os dos colaboradores fictícios do
// banco local.

import type {
  ColaboradorDoPeriodoRH,
  FiltrosPainelAbsenteismo,
  LinhaPainelAbsenteismo,
  PainelAbsenteismo,
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
  unidade: ColaboradorDoPeriodoRH["unidade"],
): ColaboradorDoPeriodoRH {
  return { id, nome, matricula_vr, cargo, unidade, ativo: true };
}

function linha(
  dados: ColaboradorDoPeriodoRH,
  valores: Partial<LinhaPainelAbsenteismo>,
): LinhaPainelAbsenteismo {
  return {
    colaborador: dados,
    equipe: dados.unidade ? `Operações ${dados.unidade.nome}` : "",
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
    jornadas_incompletas: 0,
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
  jornada_incompleta: (l: LinhaPainelAbsenteismo) => (l.jornadas_incompletas ?? 0) > 0,
};

/**
 * Aplica os filtros como a API: unidade nos cards e nas linhas, o resto só
 * nas linhas.
 */
export function painelAbsenteismoDeExemplo(filtros: FiltrosPainelAbsenteismo): PainelAbsenteismo {
  const daUnidade = LINHAS.filter(
    (l) => filtros.unidade === undefined || l.colaborador.unidade?.id === filtros.unidade,
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
    parametros: {
      meta_percentual: "5.00",
      faixas_cadastradas: true,
      limite_atraso_minutos: 15,
      vigente_a_partir_de: null,
    },
    cards: {
      percentual_periodo: media,
      faixa_critica: daUnidade.filter((l) => l.faixa === "critica").length,
      faixa_atencao: daUnidade.filter((l) => l.faixa === "atencao").length,
      pendencias: daUnidade.reduce((soma, l) => soma + l.pendencias, 0),
      colaboradores_provisorios: daUnidade.filter((l) => l.provisorio).length,
      colaboradores: daUnidade.length,
      unidades: new Set(daUnidade.map((l) => l.colaborador.unidade?.id)).size,
      ultima_importacao: "2026-10-01T08:12:00-03:00",
      importacao_parada: false,
      dados_ate: "2026-09-30",
    },
    linhas,
  };
}
