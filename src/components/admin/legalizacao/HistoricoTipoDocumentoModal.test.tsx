import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoricoTipoDocumentoModal } from "./HistoricoTipoDocumentoModal";

vi.mock("@/hooks/useTiposDocumento", () => ({
  useHistoricoTipoDocumento: () => ({
    historico: [
      {
        id: 1,
        usuario: { id: 1, first_name: "Nathalya", last_name: "Almeida", email: "n@x" },
        campo: "abrangencia",
        valor_anterior: "padrao",
        valor_novo: "ambas",
        created_at: "2026-10-28T12:00:00Z",
      },
      {
        id: 2,
        usuario: { id: 1, first_name: "Nathalya", last_name: "Almeida", email: "n@x" },
        campo: "area_responsavel",
        valor_anterior: "legalizacao",
        valor_novo: "coordenacao",
        created_at: "2026-10-29T12:00:00Z",
      },
    ],
    isLoading: false,
    mensagemErro: null,
  }),
}));

describe("HistoricoTipoDocumentoModal (STC-904)", () => {
  it("a troca de abrangência aparece com os nomes das redes", () => {
    render(
      <HistoricoTipoDocumentoModal
        tipoDocumentoId={1}
        nome="Dedetização"
        abrangencia="ambas"
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("usado em")).toBeInTheDocument();
    expect(screen.getByText(/"Rede própria"/)).toBeInTheDocument();
    expect(screen.getByText(/"As duas redes"/)).toBeInTheDocument();
  });

  it("a área do tipo de Operações Especiais aparece como Ponto focal (STC-985)", () => {
    render(
      <HistoricoTipoDocumentoModal
        tipoDocumentoId={1}
        nome="Licença da ANAC"
        abrangencia="opex"
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/"Legalização"/)).toBeInTheDocument();
    expect(screen.getByText(/"Ponto focal"/)).toBeInTheDocument();
  });
});
