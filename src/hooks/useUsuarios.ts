"use client";

import useSWR from "swr";
import { listarUsuarios } from "@/lib/plataforma";
import type { Usuario } from "@/types";

export function useUsuarios() {
  const { data, error, isLoading } = useSWR<Usuario[]>("usuarios", () => listarUsuarios());

  return {
    usuarios: data ?? [],
    isLoading,
    error,
  };
}
