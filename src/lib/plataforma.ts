import api from "./api";
import type { Unidade } from "@/types";

export async function listarUnidades(): Promise<Unidade[]> {
  const { data } = await api.get<Unidade[]>("/plataforma/unidades/");
  return data;
}
