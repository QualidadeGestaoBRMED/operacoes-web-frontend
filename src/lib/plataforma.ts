import api from "./api";
import type { Notificacao, RespostaPaginada, Setor, Unidade } from "@/types";

export async function listarUnidades(): Promise<Unidade[]> {
  const { data } = await api.get<Unidade[]>("/plataforma/unidades/");
  return data;
}

// Setor é uma entidade de plataforma (não módulo-scoped por URL, ao contrário
// de tipos-gestao/categorias) -- sem o filtro "modulo", a lista mistura
// setores de QUALQUER módulo (Legalização, Gestão RH etc., já cadastrados na
// sidebar como "em breve"). Achado no review: hoje invisível porque só existe
// 1 setor no banco de dev sem módulo definido, mas quebraria assim que outro
// módulo ganhasse os próprios setores.
export async function listarSetores(moduloId?: number): Promise<Setor[]> {
  const { data } = await api.get<Setor[]>("/plataforma/setores/", {
    params: moduloId ? { modulo: moduloId } : undefined,
  });
  return data;
}

export async function listarNotificacoes(
  filtros?: { lida?: boolean },
): Promise<RespostaPaginada<Notificacao>> {
  const { data } = await api.get<RespostaPaginada<Notificacao>>("/plataforma/notificacoes/", {
    params: filtros,
  });
  return data;
}

export async function marcarNotificacaoComoLida(id: number): Promise<Notificacao> {
  const { data } = await api.patch<Notificacao>(`/plataforma/notificacoes/${id}/marcar-lida/`);
  return data;
}

export async function marcarTodasNotificacoesComoLidas(): Promise<void> {
  await api.post("/plataforma/notificacoes/marcar-todas-lidas/");
}
