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

export function formatarTamanhoArquivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
