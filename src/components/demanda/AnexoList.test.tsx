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

    render(<AnexoList demandaId={1} podeAnexar />);

    expect(screen.getByRole("button", { name: /Enviando\.\.\. 42%/ })).toBeDisabled();
  });

  it("sem progresso ainda (preparando), mostra só 'Enviando...'", () => {
    envio({ isLoading: true, progresso: 0 });

    render(<AnexoList demandaId={1} podeAnexar />);

    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  });

  it("fora de um envio, oferece adicionar anexo", () => {
    envio({ isLoading: false, progresso: null });

    render(<AnexoList demandaId={1} podeAnexar />);

    expect(screen.getByRole("button", { name: /Adicionar anexo/ })).toBeEnabled();
  });
});
