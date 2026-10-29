import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Só a configuração passada ao SWR: o intervalo de atualização de cada hook
// do Kanban e da demanda aberta (STC-929). Os dados em si não importam aqui.
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

import { useAnexos } from "./useAnexos";
import { useComentarios } from "./useComentarios";
import { useDemanda, useDemandasDaFase } from "./useDemandas";
import { useHistorico } from "./useHistorico";
import { useResumoDemandas } from "./useResumoDemandas";

const TRINTA_SEGUNDOS = 30_000;

describe("intervalos de atualização do Kanban (STC-929)", () => {
  beforeEach(() => {
    configuracoes.length = 0;
  });

  it("coluna do Kanban: só a primeira página atualiza a cada 30 segundos", () => {
    renderHook(() => useDemandasDaFase({}, "backlog"));

    const comAtualizacao = configuracoes.filter((c) => c?.refreshInterval !== undefined);
    expect(comAtualizacao.map((c) => c?.refreshInterval)).toEqual([TRINTA_SEGUNDOS]);
    // As páginas extras não entram na atualização periódica nem na volta à aba.
    expect(configuracoes.some((c) => c?.revalidateOnFocus === false)).toBe(true);
  });

  it.each<[string, () => unknown]>([
    ["resumo", () => useResumoDemandas({})],
    ["detalhe da demanda", () => useDemanda(1)],
    ["comentários", () => useComentarios(1)],
    ["histórico", () => useHistorico(1)],
    ["anexos", () => useAnexos(1)],
  ])("%s atualiza a cada 30 segundos", (_nome, hook) => {
    renderHook(hook);

    expect(configuracoes.at(-1)?.refreshInterval).toBe(TRINTA_SEGUNDOS);
  });

  it("a coluna pausada (card sendo arrastado) não atualiza sozinha", () => {
    renderHook(() => useDemandasDaFase({}, "backlog", { pausado: true }));

    expect(configuracoes.some((c) => c?.refreshInterval === 0)).toBe(true);
    expect(configuracoes.some((c) => c?.refreshInterval === TRINTA_SEGUNDOS)).toBe(false);
  });

  it("a primeira página da coluna e o resumo atualizam ao voltar para a aba", () => {
    renderHook(() => useDemandasDaFase({}, "backlog"));
    renderHook(() => useResumoDemandas({}));

    const comAtualizacao = configuracoes.filter((c) => c?.refreshInterval !== undefined);
    for (const configuracao of comAtualizacao) {
      expect(configuracao?.revalidateOnFocus).not.toBe(false);
    }
  });
});
