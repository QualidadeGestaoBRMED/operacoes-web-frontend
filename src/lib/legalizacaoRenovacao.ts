import type { StatusProcessoRenovacao } from "@/types/legalizacao";

// Usado no modal de renovação, no detalhe do documento (histórico, aba
// Protocolo) e nos comentários da renovação.
export const LABEL_STATUS_PROCESSO: Record<StatusProcessoRenovacao, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  protocolado: "Protocolado",
  concluido: "Concluído",
};

// created_at é datetime UTC completo -- fatiar a string crua ("YYYY-MM-DD"
// dos 10 primeiros caracteres) mostraria o dia errado pra quem estiver num
// fuso atrás de UTC durante a virada (achado em análise de falhas
// críticas). new Date(iso) + Intl já convertem pro fuso do navegador,
// mesmo princípio de formatarDataHora (@/lib/utils).
const FORMATADOR_DATA_LOCAL = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatarDataDeDatetime(iso: string) {
  return FORMATADOR_DATA_LOCAL.format(new Date(iso));
}
