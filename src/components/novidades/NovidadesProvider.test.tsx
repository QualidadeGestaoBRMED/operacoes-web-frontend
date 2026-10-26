import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NovidadeResumida } from "@/lib/novidades";
import { NovidadesProvider, useNovidades } from "./NovidadesProvider";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useNavegacao", () => ({ useNavegacao: vi.fn() }));
vi.mock("@/hooks/useModulos", () => ({ useModulos: vi.fn() }));
vi.mock("@/lib/plataforma", () => ({ marcarNovidadesComoVistas: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
import { useModulos } from "@/hooks/useModulos";
import { useNavegacao } from "@/hooks/useNavegacao";
import { marcarNovidadesComoVistas } from "@/lib/plataforma";

const recarregarUsuario = vi.fn();

function novidade(id: string, extra: Partial<NovidadeResumida> = {}): NovidadeResumida {
  return {
    id,
    data: id.slice(0, 10),
    titulo: id,
    resumo: "",
    modulos: [],
    admin: false,
    destaque: false,
    imagem: null,
    ajuda: null,
    ...extra,
  };
}

const NOVIDADES = [
  novidade("2026-10-26-01-celular", { destaque: true }),
  novidade("2026-10-20-01-horas-perdidas", { modulos: ["gestao-rh"] }),
];

function usuario(ultima: string | undefined) {
  vi.mocked(useAuth).mockReturnValue({
    user: ultima === undefined ? {} : { ultima_novidade_vista: ultima },
    recarregarUsuario,
  } as unknown as ReturnType<typeof useAuth>);
}

function montar() {
  return renderHook(() => useNovidades(), {
    wrapper: ({ children }) => <NovidadesProvider novidades={NOVIDADES}>{children}</NovidadesProvider>,
  }).result;
}

beforeEach(() => {
  sessionStorage.clear();
  recarregarUsuario.mockReset();
  vi.mocked(marcarNovidadesComoVistas).mockReset().mockResolvedValue("2026-10-26-01-celular");
  vi.mocked(useModulos).mockReturnValue({
    isLoading: false,
  } as unknown as ReturnType<typeof useModulos>);
  vi.mocked(useNavegacao).mockReturnValue({
    modulos: [{ codigo: "gestao-rh" }],
    temAdministracao: false,
  } as unknown as ReturnType<typeof useNavegacao>);
});

describe("useNovidades (STC-877)", () => {
  it("sem saber o que a pessoa já viu: sem ponto e sem destaque, para não piscar", () => {
    usuario(undefined);
    const resultado = montar();
    expect(resultado.current.temNovidade).toBe(false);
    expect(resultado.current.destaque).toBeNull();
  });

  it("com os módulos ainda carregando: sem ponto, sem destaque e sem marcar", async () => {
    usuario("");
    vi.mocked(useModulos).mockReturnValue({
      isLoading: true,
    } as unknown as ReturnType<typeof useModulos>);
    const resultado = montar();

    expect(resultado.current.temNovidade).toBe(false);
    expect(resultado.current.destaque).toBeNull();
    await act(() => resultado.current.marcarComoVistas());
    expect(marcarNovidadesComoVistas).not.toHaveBeenCalled();
  });

  it("quem nunca abriu: ponto e o destaque", () => {
    usuario("");
    const resultado = montar();
    expect(resultado.current.temNovidade).toBe(true);
    expect(resultado.current.destaque?.id).toBe("2026-10-26-01-celular");
  });

  it("já viu a mais nova: sem ponto e sem destaque", () => {
    usuario("2026-10-26-01-celular");
    const resultado = montar();
    expect(resultado.current.temNovidade).toBe(false);
    expect(resultado.current.destaque).toBeNull();
  });

  it("marcar envia a mais nova visível e recarrega o usuário", async () => {
    usuario("2026-10-20-01-horas-perdidas");
    const resultado = montar();

    await act(() => resultado.current.marcarComoVistas());

    expect(marcarNovidadesComoVistas).toHaveBeenCalledWith("2026-10-26-01-celular");
    expect(recarregarUsuario).toHaveBeenCalled();
  });

  it("já vista ou no ver como: não envia", async () => {
    usuario("2026-10-26-01-celular");
    const jaVista = montar();
    await act(() => jaVista.current.marcarComoVistas());

    usuario("");
    sessionStorage.setItem(
      "atlas.verComo",
      JSON.stringify({
        id: "6f1c2a7e-0000-4000-8000-000000000001",
        usuario: { id: 7, nome: "Coordenação" },
        admin: { id: 1, nome: "Admin" },
        iniciada_em: "2026-10-19T15:00:00Z",
        expira_em: "2099-10-19T16:00:00Z",
      }),
    );
    const emVerComo = montar();
    await act(() => emVerComo.current.marcarComoVistas());

    expect(marcarNovidadesComoVistas).not.toHaveBeenCalled();
  });
});
