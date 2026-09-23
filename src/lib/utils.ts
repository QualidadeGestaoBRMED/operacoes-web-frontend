import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Usuario } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Extraído do AppShell (era só local lá) -- DemandaCard também precisa
// derivar iniciais/nome de um Usuario, sem duplicar a mesma lógica.
export function nomeExibicao(usuario: Pick<Usuario, "first_name" | "last_name" | "username">) {
  return [usuario.first_name, usuario.last_name].filter(Boolean).join(" ").trim() || usuario.username;
}

// Achado no review: Comentario/Anexo/HistoricoAlteracao.usuario é SET_NULL
// de propósito no backend (o registro sobrevive à exclusão da conta do
// autor) -- nomeExibicao() sozinho quebraria (lendo first_name de null) pra
// qualquer registro cujo autor já não existe mais.
export function nomeOuRemovido(
  usuario: Pick<Usuario, "first_name" | "last_name" | "username"> | null,
) {
  return usuario ? nomeExibicao(usuario) : "Usuário removido";
}

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    partes
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Pro modal de detalhe (STC-168) -- created_at vem como datetime ISO
// completo (diferente de data_prevista, que é só "YYYY-MM-DD" e já tem seu
// próprio formatarData em DemandaCard.tsx).
export function formatarDataHora(iso: string) {
  return FORMATADOR_DATA_HORA.format(new Date(iso)).replace(",", " ·");
}

// Pro menu de notificações (STC-169) -- created_at vem como datetime ISO
// completo, mas ali "22/07/2026 · 14:30" (formatarDataHora) é verboso
// demais pra uma lista curta e recente; relativo ("5min atrás") é o padrão
// desse tipo de UI. Cai pra formatarDataHora depois de 7 dias -- "12d
// atrás" fica menos legível que a data em si a partir daí.
export function formatarTempoRelativo(iso: string) {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos}min atrás`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h atrás`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias}d atrás`;
  return formatarDataHora(iso);
}

// Pro pré-preenchimento de campos <input type="date"> com a data de hoje
// (STC-523) -- não usar `new Date().toISOString().slice(0, 10)`: toISOString
// converte pra UTC antes de fatiar, então entre 21h e 23h59 no horário de
// Brasília (UTC-3) já é o dia seguinte em UTC, pré-preenchendo com amanhã.
// Monta a partir dos componentes locais (getFullYear/Month/Date) em vez de
// converter fuso.
export function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function formatarTamanhoArquivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
