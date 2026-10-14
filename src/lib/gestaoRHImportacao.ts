import api from "./api";

// Importação dos relatórios do VR (STC-587): a tela é a contingência do robô,
// que envia os mesmos 3 arquivos pela mesma rota.

export type RelatorioVR = "jornada" | "abonos" | "pendencias";
export type OrigemImportacao = "planilha" | "api" | "robo";
export type SituacaoImportacao = "processando" | "concluida" | "recusada";

export interface LoteImportacao {
  id: number;
  origem: OrigemImportacao;
  status: SituacaoImportacao;
  motivo_recusa: string;
  periodo_inicio: string;
  periodo_fim: string;
  linhas_processadas: number;
  linhas_rejeitadas: number;
  obtido_em: string;
  concluido_em: string | null;
  /** Nulo quando o lote veio do robô. */
  enviado_por: string | null;
  /** Equipes que apareceram pela primeira vez no lote (entram sem categoria). */
  equipes_novas: { id: number; nome: string }[];
}

export interface LinhaRejeitada {
  relatorio: RelatorioVR;
  linha: number;
  colaborador: string;
  motivo: string;
}

export type ArquivosImportacao = Record<RelatorioVR, File>;

const IMPORTACOES_URL = "/modulos/gestao-rh/importacoes/";

/** Na ordem da tela; o nome é o do modelo salvo na conta do VR. */
export const RELATORIOS_VR: { valor: RelatorioVR; rotulo: string; dica: string }[] = [
  { valor: "jornada", rotulo: "Jornada", dica: "Espelho de ponto de todas as equipes" },
  { valor: "abonos", rotulo: "Abonos", dica: "Atestados e ausências justificadas do período" },
  { valor: "pendencias", rotulo: "Pendências", dica: "Ajustes de ponto do período" },
];

export const ROTULO_RELATORIO: Record<RelatorioVR, string> = {
  jornada: "Jornada",
  abonos: "Abonos",
  pendencias: "Pendências",
};

// O envio pela tela passa pelo proxy da Vercel, que aceita até 4,5 MB por
// requisição; abaixo disto os 3 arquivos cabem com folga para o envelope do
// multipart. O robô chama o backend direto e não tem esse limite.
export const LIMITE_ENVIO_BYTES = 4 * 1024 * 1024;

export async function listarImportacoes(): Promise<LoteImportacao[]> {
  const { data } = await api.get<LoteImportacao[]>(IMPORTACOES_URL);
  return data;
}

export async function importarRelatorios(
  arquivos: ArquivosImportacao,
  periodoInicio: string,
  periodoFim: string,
): Promise<LoteImportacao> {
  const formData = new FormData();
  for (const { valor } of RELATORIOS_VR) formData.append(valor, arquivos[valor]);
  formData.append("periodo_inicio", periodoInicio);
  formData.append("periodo_fim", periodoFim);
  const { data } = await api.post<LoteImportacao>(IMPORTACOES_URL, formData);
  return data;
}

export async function listarLinhasRejeitadas(loteId: number): Promise<LinhaRejeitada[]> {
  const { data } = await api.get<LinhaRejeitada[]>(`${IMPORTACOES_URL}${loteId}/rejeitadas/`);
  return data;
}

function isoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Dia 1 do mês anterior até ontem: a mesma janela do robô. Datas locais (ver hojeISO). */
export function periodoPadrao(hoje = new Date()): { inicio: string; fim: string } {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  return { inicio: isoLocal(inicio), fim: isoLocal(ontem) };
}
