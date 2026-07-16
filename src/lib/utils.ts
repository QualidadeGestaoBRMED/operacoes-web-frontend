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
