import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { useAnexos, useEnviarAnexo, useExcluirAnexo } from "@/hooks/useAnexos";
import { AnexoList } from "./AnexoList";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useAnexos", () => ({
  useAnexos: vi.fn(),
  useEnviarAnexo: vi.fn(),
  useExcluirAnexo: vi.fn(),
}));

function envio(estado: { isLoading: boolean; progresso: number | null }) {
  vi.mocked(useEnviarAnexo).mockReturnValue({
    enviar: vi.fn(),
    error: undefined,
    mensagemErro: null,
    ...estado,
  } as never);
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: { usuarioId: 1 }, isAdminOps: false } as never);
  vi.mocked(useAnexos).mockReturnValue({
    anexos: [],
    isLoading: false,
    error: undefined,
    mensagemErro: null,
    mutate: vi.fn(),
  } as never);
  vi.mocked(useExcluirAnexo).mockReturnValue({ excluir: vi.fn(), isLoading: false } as never);
});

describe("AnexoList -- progresso do envio (STC-628)", () => {
  it("mostra a porcentagem enviada durante o envio", () => {
    envio({ isLoading: true, progresso: 0.42 });

    render(<AnexoList demandaId={1} podeAnexar rede="padrao" />);

    expect(screen.getByRole("button", { name: /Enviando\.\.\. 42%/ })).toBeDisabled();
  });

  it("sem progresso ainda (preparando), mostra só 'Enviando...'", () => {
    envio({ isLoading: true, progresso: 0 });

    render(<AnexoList demandaId={1} podeAnexar rede="padrao" />);

    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  });

  it("fora de um envio, oferece adicionar anexo", () => {
    envio({ isLoading: false, progresso: null });

    render(<AnexoList demandaId={1} podeAnexar rede="padrao" />);

    expect(screen.getByRole("button", { name: /Adicionar anexo/ })).toBeEnabled();
  });
});

describe("AnexoList -- excluir anexo de outra pessoa pela rede (STC-747)", () => {
  function comAnexoDeOutraPessoa() {
    envio({ isLoading: false, progresso: null });
    vi.mocked(useAnexos).mockReturnValue({
      anexos: [
        {
          id: 7,
          usuario: { id: 2 },
          arquivo: "/media/anexo.pdf",
          nome_original: "anexo.pdf",
          tamanho: 100,
          created_at: "2026-10-16T12:00:00Z",
        },
      ],
      isLoading: false,
      error: undefined,
      mensagemErro: null,
      mutate: vi.fn(),
    } as never);
  }

  it.each([
    ["padrao", true],
    ["opex", false],
  ] as const)("Admin Operações em demanda da rede %s: botão de remover %s", (rede, aparece) => {
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 1, redes_administradas: ["padrao"] },
    } as never);
    comAnexoDeOutraPessoa();

    render(<AnexoList demandaId={1} podeAnexar rede={rede} />);

    expect(screen.queryByTitle("Remover") !== null).toBe(aparece);
  });

  it("Gestão de Operações remove nas duas redes", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 1, redes_administradas: ["opex", "padrao"] },
    } as never);
    comAnexoDeOutraPessoa();

    render(<AnexoList demandaId={1} podeAnexar rede="opex" />);

    expect(screen.getByTitle("Remover")).toBeInTheDocument();
  });
});
