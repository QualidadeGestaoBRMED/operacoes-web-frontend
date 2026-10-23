import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { calcularGradeMapa } from "@/lib/legalizacaoMapa";
import type { Unidade } from "@/types";
import type { DocumentoUnidade } from "@/types/legalizacao";
import { TooltipProvider } from "@/components/ui/tooltip";
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

describe("MatrizMapaGrid -- dica com o checklist do catálogo (STC-866)", () => {
  const checklist = () => ({
    itens: [
      { tipoId: 2, nome: "Licença Ambiental", situacao: "falta" as const, quantidade: 0 },
      { tipoId: 1, nome: "Alvará de Funcionamento", situacao: "cadastrado" as const, quantidade: 1 },
      { tipoId: 3, nome: "Calibração", situacao: "cadastrado" as const, quantidade: 8 },
      { tipoId: 5, nome: "Publicidade", situacao: "nao_aplica" as const, quantidade: 0 },
    ],
    cadastrados: 2,
    aplicaveis: 3,
  });

  function renderComDica() {
    const grade = calcularGradeMapa([documento("regular")], [NITEROI]);
    render(
      <TooltipProvider>
        <MatrizMapaGrid grade={grade} carregando={false} checklist={checklist} />
      </TooltipProvider>,
    );
  }

  it("a célula diz quantos foram cadastrados, e a dica lista os tipos com o ícone de cada situação", async () => {
    const user = userEvent.setup();
    renderComDica();
    const celula = screen.getByRole("link", { name: /Niterói, Regulariza.*2 de 3 cadastrados/ });

    await user.hover(celula);
    const dica = within(await screen.findByRole("tooltip"));
    expect(dica.getByText("2 de 3 cadastrados")).toBeInTheDocument();
    expect(dica.getAllByRole("img", { name: "falta cadastrar" })).toHaveLength(1);
    expect(dica.getAllByRole("img", { name: "cadastrado" })).toHaveLength(2);
    expect(dica.getAllByRole("img", { name: "não se aplica" })).toHaveLength(1);
    expect(dica.getByText("Calibração · 8")).toBeInTheDocument();
    // O clique continua levando à lista filtrada.
    expect(celula).toHaveAttribute("href", "/modulos/legalizacao?unidade=1&categoria=regularizacao");
  });

  it("célula sem documento ganha foco pelo teclado para abrir a dica", async () => {
    const user = userEvent.setup();
    renderComDica();
    const vazia = screen.getByLabelText(/Niterói, Registros.*2 de 3 cadastrados/);
    expect(vazia).toHaveAttribute("tabindex", "0");
    await user.hover(vazia);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("categoria toda Não aplicável diz que nenhum se aplica, em vez de 0 de 0", async () => {
    const user = userEvent.setup();
    const grade = calcularGradeMapa([documento("regular")], [NITEROI]);
    render(
      <TooltipProvider>
        <MatrizMapaGrid
          grade={grade}
          carregando={false}
          checklist={() => ({
            itens: [{ tipoId: 5, nome: "Publicidade", situacao: "nao_aplica", quantidade: 0 }],
            cadastrados: 0,
            aplicaveis: 0,
          })}
        />
      </TooltipProvider>,
    );
    await user.hover(screen.getByRole("link", { name: /Niterói, Regulariza/ }));
    const dica = within(await screen.findByRole("tooltip"));
    expect(dica.getByText("Nenhum se aplica a esta unidade")).toBeInTheDocument();
    expect(dica.queryByText("0 de 0 cadastrados")).not.toBeInTheDocument();
  });

  it("sem o checklist, sem dica nem foco extra", () => {
    const grade = calcularGradeMapa([documento("regular")], [NITEROI]);
    render(<MatrizMapaGrid grade={grade} carregando={false} />);
    expect(screen.getByLabelText(/Niterói, Registros/)).not.toHaveAttribute("tabindex");
  });
});
