import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Só a configuração passada ao SWR: o intervalo de atualização de cada hook
// (STC-911). Os dados em si não importam aqui.
const configuracoes: Array<Record<string, unknown> | undefined> = [];
vi.mock("swr", async (original) => {
  const real = await original<typeof import("swr")>();
  return {
    ...real,
    default: (_chave: unknown, _busca: unknown, configuracao?: Record<string, unknown>) => {
      configuracoes.push(configuracao);
      return { data: undefined, error: undefined, isLoading: true, isValidating: false, mutate: vi.fn() };
    },
  };
});

import {
  useDocumentoLegalizacao,
  useDocumentosLegalizacao,
  useEvidenciasVigentes,
} from "./useDocumentosLegalizacao";

const CINCO_MINUTOS = 5 * 60_000;

describe("intervalos de atualização da Legalização (STC-911)", () => {
  beforeEach(() => {
    configuracoes.length = 0;
  });

  it("a lista de documentos (Matriz, Mapa) atualiza a cada 5 minutos", () => {
    renderHook(() => useDocumentosLegalizacao({}));

    expect(configuracoes.at(-1)?.refreshInterval).toBe(CINCO_MINUTOS);
  });

  it("a lista pausada (filtros) continua sem atualizar sozinha", () => {
    renderHook(() => useDocumentosLegalizacao({}, { pausado: true }));

    expect(configuracoes.at(-1)?.refreshInterval).toBe(0);
  });

  it("as evidências da Biblioteca atualizam a cada 5 minutos", () => {
    renderHook(() => useEvidenciasVigentes(1));

    expect(configuracoes.at(-1)?.refreshInterval).toBe(CINCO_MINUTOS);
  });

  it("o detalhe de um documento segue a cada 60 segundos", () => {
    renderHook(() => useDocumentoLegalizacao(1));

    expect(configuracoes.at(-1)?.refreshInterval).toBe(60_000);
  });

  it("nenhum deles desliga a atualização ao voltar para a aba", () => {
    renderHook(() => useDocumentosLegalizacao({}));
    renderHook(() => useEvidenciasVigentes(1));

    for (const configuracao of configuracoes) {
      expect(configuracao?.revalidateOnFocus).not.toBe(false);
    }
  });
});
