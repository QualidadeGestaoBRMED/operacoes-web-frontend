import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarDemanda } from "@/test-utils/fixtures";
import { KanbanColumn } from "./KanbanColumn";

// IntersectionObserver de mentira: guarda o callback para o teste dizer
// quando o fim da coluna apareceu.
let aoAparecer: ((entradas: { isIntersecting: boolean }[]) => void) | null = null;
class ObservadorFalso {
  constructor(callback: (entradas: { isIntersecting: boolean }[]) => void) {
    aoAparecer = callback;
  }
  observe() {}
  disconnect() {}
}

function renderColuna(props: Partial<Parameters<typeof KanbanColumn>[0]> = {}) {
  return render(
    <DndContext>
      <KanbanColumn
        status="concluido"
        titulo="Concluído"
        demandas={[criarDemanda({ id: 1, titulo: "Card carregado", status: "concluido" })]}
        total={1}
        onSelecionarDemanda={vi.fn()}
        onRestaurar={vi.fn()}
        {...props}
      />
    </DndContext>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  aoAparecer = null;
});

describe("KanbanColumn com carregamento por fase (STC-931)", () => {
  it("mostra no cabeçalho o total da fase, não só os cards carregados", () => {
    renderColuna({ total: 103, temMais: true });

    expect(screen.getByText("103")).toBeInTheDocument();
  });

  it("pede mais quando o fim da coluna aparece", () => {
    vi.stubGlobal("IntersectionObserver", ObservadorFalso);
    const onCarregarMais = vi.fn();
    renderColuna({ total: 103, temMais: true, onCarregarMais });

    aoAparecer?.([{ isIntersecting: true }]);

    expect(onCarregarMais).toHaveBeenCalledTimes(1);
  });

  it("botão Carregar mais para quem não rola (teclado)", async () => {
    const onCarregarMais = vi.fn();
    renderColuna({ total: 103, temMais: true, onCarregarMais });

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(onCarregarMais).toHaveBeenCalledTimes(1);
  });

  it("enquanto carrega, mostra o aviso no lugar do botão", () => {
    renderColuna({ total: 103, temMais: true, carregandoMais: true });

    expect(screen.getByText("Carregando mais...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("sem mais páginas, não mostra o fim da coluna", () => {
    renderColuna({ total: 1, temMais: false });

    expect(screen.queryByTestId("fim-concluido")).not.toBeInTheDocument();
  });

  it("coluna vazia com mais páginas (foco dos cartões) não diz que está vazia", () => {
    renderColuna({ demandas: [], total: 0, temMais: true });

    expect(screen.queryByText("Nenhuma demanda aqui")).not.toBeInTheDocument();
    expect(screen.getByTestId("fim-concluido")).toBeInTheDocument();
  });

  it("falha na primeira página mostra o erro e o botão de tentar de novo", async () => {
    const onTentarDeNovo = vi.fn();
    renderColuna({ erro: "Falha de rede", onTentarDeNovo });

    expect(screen.getByRole("alert")).toHaveTextContent("Falha de rede");
    expect(screen.queryByText("Card carregado")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onTentarDeNovo).toHaveBeenCalledTimes(1);
  });

  it("falha na página seguinte mantém os cards e não fica pedindo sozinha", () => {
    vi.stubGlobal("IntersectionObserver", ObservadorFalso);
    const onCarregarMais = vi.fn();
    renderColuna({
      total: 103,
      temMais: true,
      onCarregarMais,
      erroAoCarregarMais: "Falha de rede",
      onTentarDeNovo: vi.fn(),
    });

    expect(screen.getByText("Card carregado")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falha de rede");
    expect(screen.queryByTestId("fim-concluido")).not.toBeInTheDocument();
    expect(aoAparecer).toBeNull();
    expect(onCarregarMais).not.toHaveBeenCalled();
  });
});
