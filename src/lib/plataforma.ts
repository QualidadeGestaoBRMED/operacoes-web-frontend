import api from "./api";
import type {
  Notificacao,
  PermissaoUsuario,
  PermissaoUsuarioPayload,
  RespostaPaginada,
  Setor,
  Unidade,
  Usuario,
} from "@/types";

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

// UsuarioViewSet.list era admin-only até o STC-193 -- passou a aceitar
// qualquer usuário com Perfil, já que atribuir responsável também é (mesma
// regra do backend: quem tem acesso de escrita à demanda, não só admin). Sem
// filtro de unidade aqui: o backend permite um usuário sem unidade (admin)
// como responsável de qualquer demanda, e o filtro por unidade é aplicado no
// cliente (ver ResponsavelSection), não na busca.
export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/plataforma/usuarios/", {
    params: { ativo: true },
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

// PermissaoUsuarioViewSet (STC-266) -- restrito a Admin Operações/Admin
// Q&G no backend (IsAdminOperacoes); a UI só chega aqui pra quem já passou
// pelo mesmo gate no Sidebar (isAdminOps), mas o backend é sempre quem
// decide de verdade.
export async function listarPermissoes(): Promise<PermissaoUsuario[]> {
  const { data } = await api.get<PermissaoUsuario[]>("/plataforma/permissoes-usuario/");
  return data;
}

export async function criarPermissao(
  payload: PermissaoUsuarioPayload,
): Promise<PermissaoUsuario> {
  const { data } = await api.post<PermissaoUsuario>("/plataforma/permissoes-usuario/", payload);
  return data;
}

// Revogar = desativar, não excluir -- mantém o registro como histórico de
// auditoria de quem teve acesso a quê (mesmo espírito de soft-delete já
// usado em Demanda).
export async function revogarPermissao(id: number): Promise<PermissaoUsuario> {
  const { data } = await api.patch<PermissaoUsuario>(
    `/plataforma/permissoes-usuario/${id}/`,
    { ativo: false },
  );
  return data;
}
