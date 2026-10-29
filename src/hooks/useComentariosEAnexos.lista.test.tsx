import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarComentario, enviarAnexo, excluirAnexo } from "@/lib/demandas";
import { useEnviarAnexo, useExcluirAnexo } from "./useAnexos";
import { fonteDaDemanda, useCriarComentario } from "./useComentarios";

// Comentar ou anexar muda os contadores do card no Kanban (STC-929): a lista
// do Kanban é buscada de novo na hora, sem esperar a atualização de 30 s.
vi.mock("@/lib/demandas", async (original) => ({
  ...(await original<typeof import("@/lib/demandas")>()),
  criarComentario: vi.fn(),
  enviarAnexo: vi.fn(),
  excluirAnexo: vi.fn(),
}));

const buscarLista = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

function comListaDoKanban<T>(hook: () => T) {
  return () => {
    useSWR(["demandas", { tipo_gestao: 2 }], buscarLista);
    return hook();
  };
}

beforeEach(() => {
  buscarLista.mockReset().mockResolvedValue([]);
  vi.mocked(criarComentario).mockReset().mockResolvedValue({} as never);
  vi.mocked(enviarAnexo).mockReset().mockResolvedValue({} as never);
  vi.mocked(excluirAnexo).mockReset().mockResolvedValue(undefined as never);
});

async function listaBuscadaDeNovoDepois(acao: () => Promise<unknown>) {
  await waitFor(() => expect(buscarLista).toHaveBeenCalledTimes(1));
  await act(acao);
  await waitFor(() => expect(buscarLista).toHaveBeenCalledTimes(2));
}

describe("Kanban atualizado depois de comentar ou anexar (STC-929)", () => {
  it("comentário na demanda", async () => {
    const { result } = renderHook(
      comListaDoKanban(() => useCriarComentario(fonteDaDemanda(7))),
      { wrapper },
    );

    await listaBuscadaDeNovoDepois(() => result.current.criar("Tudo certo."));
  });

  it("anexo enviado", async () => {
    const { result } = renderHook(comListaDoKanban(() => useEnviarAnexo(7)), { wrapper });

    await listaBuscadaDeNovoDepois(() =>
      result.current.enviar(new File(["x"], "carta.pdf", { type: "application/pdf" })),
    );
  });

  it("anexo excluído", async () => {
    const { result } = renderHook(comListaDoKanban(() => useExcluirAnexo(7)), { wrapper });

    await listaBuscadaDeNovoDepois(() => result.current.excluir(3));
  });

  it("comentário fora do Kanban não busca a lista", async () => {
    const fonte = {
      chave: ["documento-legalizacao", 9, "comentarios"] as const,
      listar: vi.fn().mockResolvedValue([]),
      criar: vi.fn().mockResolvedValue({}),
    };
    const { result } = renderHook(comListaDoKanban(() => useCriarComentario(fonte)), {
      wrapper,
    });

    await waitFor(() => expect(buscarLista).toHaveBeenCalledTimes(1));
    await act(() => result.current.criar("Protocolado."));
    expect(fonte.criar).toHaveBeenCalled();
    expect(buscarLista).toHaveBeenCalledTimes(1);
  });
});
