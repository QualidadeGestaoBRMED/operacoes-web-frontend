import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { obterUsuarioLogado } from "@/lib/plataforma";
import type { Usuario } from "@/types";
import { useAuth } from "./useAuth";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/plataforma", () => ({ obterUsuarioLogado: vi.fn() }));

const ADMIN_OPERACOES = { id: 2, nome: "Admin Operações", descricao: "", nivel: 2 };
const GESTAO_OPERACOES = { id: 6, nome: "Gestão de Operações", descricao: "", nivel: 6 };

function sessaoCom(perfil: typeof ADMIN_OPERACOES | null, usuarioId = 10) {
  vi.mocked(useSession).mockReturnValue({
    data: {
      expires: "2099-01-01T00:00:00Z",
      user: { id: "google-123", usuarioId, perfil },
    },
    status: "authenticated",
    update: vi.fn(),
  } as unknown as ReturnType<typeof useSession>);
}

function usuarioDaApi(dados: Partial<Usuario>): Usuario {
  return { id: 10, perfil: null, ...dados } as Usuario;
}

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

beforeEach(() => {
  vi.mocked(obterUsuarioLogado).mockReset();
});

describe("useAuth com os dados atuais do usuário (STC-763)", () => {
  it("usa o cargo atual da API, não o gravado no login", async () => {
    sessaoCom(ADMIN_OPERACOES);
    vi.mocked(obterUsuarioLogado).mockResolvedValue(
      usuarioDaApi({ perfil: GESTAO_OPERACOES, redes_administradas: ["opex", "padrao"] }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.perfil?.nivel).toBe(6));
    expect(result.current.confirmandoCargo).toBe(false);
    expect(result.current.administraAsDuasRedes).toBe(true);
    // Identificadores continuam os da sessão.
    expect(result.current.user?.usuarioId).toBe(10);
    expect(result.current.user?.id).toBe("google-123");
  });

  it("vale a sessão enquanto a API não responde", () => {
    sessaoCom(ADMIN_OPERACOES);
    vi.mocked(obterUsuarioLogado).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.perfil?.nivel).toBe(2);
    expect(result.current.isAdminOps).toBe(true);
    expect(result.current.administraRedePadrao).toBe(true);
    expect(result.current.confirmandoCargo).toBe(true);
  });

  it("vale a sessão se a API falhar", async () => {
    sessaoCom(ADMIN_OPERACOES);
    vi.mocked(obterUsuarioLogado).mockRejectedValue(new Error("rede"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.confirmandoCargo).toBe(false));
    expect(result.current.perfil?.nivel).toBe(2);
    expect(result.current.isAdminOps).toBe(true);
  });

  it("cargo retirado tira os botões de Admin", async () => {
    sessaoCom(ADMIN_OPERACOES);
    vi.mocked(obterUsuarioLogado).mockResolvedValue(
      usuarioDaApi({ perfil: null, redes_administradas: [] }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAdminOps).toBe(false));
  });

  it("ignora resposta de outra conta", async () => {
    sessaoCom(ADMIN_OPERACOES);
    vi.mocked(obterUsuarioLogado).mockResolvedValue(
      usuarioDaApi({ id: 99, perfil: GESTAO_OPERACOES, redes_administradas: ["opex", "padrao"] }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(obterUsuarioLogado).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current.perfil?.nivel).toBe(2);
  });

  it("sem login não consulta a API", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(obterUsuarioLogado).not.toHaveBeenCalled();
    expect(result.current.user).toBeUndefined();
    expect(result.current.confirmandoCargo).toBe(false);
    expect(result.current.isAdminOps).toBe(false);
  });
});

describe("useAuth em ver como (STC-790)", () => {
  const ADMIN_QG = { id: 1, nome: "Admin Q&G", descricao: "", nivel: 1 };
  const UNIDADE = { id: 3, nome: "Unidade", descricao: "", nivel: 3 };
  const SESSAO = {
    id: "6f1c2a7e-0000-4000-8000-000000000001",
    usuario: { id: 7, nome: "Coordenação Niterói" },
    admin: { id: 10, nome: "Felipe" },
    iniciada_em: "2026-10-19T12:00:00Z",
    expira_em: new Date(Date.now() + 3_600_000).toISOString(),
  };

  beforeEach(() => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify(SESSAO));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("a tela é a da pessoa simulada quando o Admin real é quem está logado", async () => {
    sessaoCom(ADMIN_QG);
    vi.mocked(obterUsuarioLogado).mockResolvedValue({
      ...usuarioDaApi({ id: 7, perfil: UNIDADE, first_name: "Coordenação", last_name: "Niterói" }),
      foto_url: "https://foto.exemplo/c.jpg",
      ver_como: SESSAO,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.perfil?.nivel).toBe(3));
    expect(result.current.isAdminQG).toBe(false);
    expect(result.current.user?.usuarioId).toBe(7);
    expect(result.current.user?.name).toBe("Coordenação Niterói");
    expect(result.current.user?.image).toBe("https://foto.exemplo/c.jpg");
    expect(result.current.verComo?.id).toBe(SESSAO.id);
  });

  it("enquanto a pessoa não chega, espera em vez de mostrar o Admin", () => {
    sessaoCom(ADMIN_QG);
    vi.mocked(obterUsuarioLogado).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it("resposta de ver como de outro Admin não vale", async () => {
    sessaoCom(ADMIN_QG, 99);
    vi.mocked(obterUsuarioLogado).mockResolvedValue({
      ...usuarioDaApi({ id: 7, perfil: UNIDADE }),
      ver_como: SESSAO,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(vi.mocked(obterUsuarioLogado)).toHaveBeenCalled());
    expect(result.current.perfil?.nivel).toBe(1);
    expect(result.current.user?.usuarioId).toBe(99);
  });

  it("se a pessoa não vier (falha), continua esperando em vez de cair no Admin", async () => {
    sessaoCom(ADMIN_QG);
    vi.mocked(obterUsuarioLogado).mockRejectedValue(new Error("rede"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(vi.mocked(obterUsuarioLogado)).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
  });
});
