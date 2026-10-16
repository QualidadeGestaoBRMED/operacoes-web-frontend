import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calcularGradeMapa } from "@/lib/legalizacaoMapa";
import type { Unidade } from "@/types";
import type { DocumentoUnidade } from "@/types/legalizacao";
import { MatrizMapaGrid } from "./MatrizMapaGrid";

vi.mock("@/hooks/useTiposDocumento", () => ({
  useTiposDocumento: () => ({ tiposDocumento: [], isLoading: false, error: undefined, mensagemErro: null }),
}));

const NITEROI: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

function documento(status: DocumentoUnidade["status"]): DocumentoUnidade {
  return {
    id: 1,
    tipo_documento: {
      id: 1,
      codigo: "alvara",
      nome: "Alvará de Funcionamento",
      categoria: "regularizacao",
      area_responsavel: "legalizacao",
      setor_apoio: "",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    unidade: NITEROI,
    status,
    justificativa_excecao: "",
    validade: null,
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function hrefDaCelula(status: DocumentoUnidade["status"]) {
  render(
    <MatrizMapaGrid grade={calcularGradeMapa([documento(status)], [NITEROI])} carregando={false} />,
  );
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .find((href) => href?.includes("categoria=regularizacao"));
}

describe("MatrizMapaGrid -- link da célula leva a situação (STC-714)", () => {
  it.each([
    ["vencido", "&situacao=vencido"],
    ["protocolado", "&situacao=atencao"],
    ["em_andamento", "&situacao=andamento"],
    ["nao_iniciado", "&situacao=nao_iniciado"],
    ["unidade_encerramento", "&situacao=encerramento"],
  ] as const)("célula de documento %s", (status, sufixo) => {
    expect(hrefDaCelula(status)).toBe(
      `/modulos/legalizacao?unidade=1&categoria=regularizacao${sufixo}`,
    );
  });

  it("célula em dia não filtra status", () => {
    expect(hrefDaCelula("regular")).toBe("/modulos/legalizacao?unidade=1&categoria=regularizacao");
  });
});
