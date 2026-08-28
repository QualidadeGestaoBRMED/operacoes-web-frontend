import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AreaResponsavel } from "@/types";
import { SeletorAreaResponsavel } from "./SeletorAreaResponsavel";

function renderSeletor(value: AreaResponsavel[], extra: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  render(
    <SeletorAreaResponsavel
      value={value}
      onChange={onChange}
      aria-label="Área Responsável"
      {...extra}
    />,
  );
  return { onChange };
}

// STC-392: achado no dogfooding -- a versão original concatenava os nomes
// selecionados sem limite nenhum, o que estourava a largura do gatilho e
// empurrava filtros vizinhos pra fora da tela num layout de linha única
// (nunca aconteceria num campo isolado de formulário, só ficou visível no
// filtro do Kanban). Estes testes travam o comportamento certo direto no
// componente, sem depender de montar o formulário/filtro inteiro.
describe("SeletorAreaResponsavel -- texto do gatilho", () => {
  it("mostra o placeholder quando nada está selecionado", () => {
    renderSeletor([], { placeholder: "Selecionar..." });
    expect(screen.getByRole("button", { name: "Área Responsável" })).toHaveTextContent(
      "Selecionar...",
    );
  });

  it("concatena os nomes com até 2 selecionadas", () => {
    renderSeletor(["gerencia", "processo"]);
    expect(screen.getByRole("button", { name: "Área Responsável" })).toHaveTextContent(
      "Gerência, Processo",
    );
  });

  it("mostra só a contagem a partir de 3 selecionadas", () => {
    renderSeletor(["gerencia", "processo", "qualidade"]);
    const gatilho = screen.getByRole("button", { name: "Área Responsável" });
    expect(gatilho).toHaveTextContent("3 selecionadas");
    expect(gatilho).not.toHaveTextContent("Gerência");
  });

  it("com todas marcadas e opcaoTodas definida, mostra esse rótulo em vez da contagem", () => {
    renderSeletor(["gerencia", "processo", "qualidade", "desenvolvimento"], {
      opcaoTodas: "Todas as áreas responsáveis",
    });
    const gatilho = screen.getByRole("button", { name: "Área Responsável" });
    expect(gatilho).toHaveTextContent("Todas as áreas responsáveis");
    expect(gatilho).not.toHaveTextContent("4 selecionadas");
  });

  it("com todas marcadas mas sem opcaoTodas, mostra a contagem normalmente", () => {
    renderSeletor(["gerencia", "processo", "qualidade", "desenvolvimento"]);
    expect(screen.getByRole("button", { name: "Área Responsável" })).toHaveTextContent(
      "4 selecionadas",
    );
  });
});

describe("SeletorAreaResponsavel -- opção 'selecionar todas'", () => {
  it("marca as 4 de uma vez quando nenhuma está marcada", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSeletor([], { opcaoTodas: "Todas as áreas responsáveis" });

    await user.click(screen.getByRole("button", { name: "Área Responsável" }));
    await user.click(screen.getByRole("checkbox", { name: "Todas as áreas responsáveis" }));

    expect(onChange).toHaveBeenCalledWith(["gerencia", "processo", "qualidade", "desenvolvimento"]);
  });

  it("desmarca todas quando as 4 já estão marcadas", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSeletor(["gerencia", "processo", "qualidade", "desenvolvimento"], {
      opcaoTodas: "Todas as áreas responsáveis",
    });

    await user.click(screen.getByRole("button", { name: "Área Responsável" }));
    await user.click(screen.getByRole("checkbox", { name: "Todas as áreas responsáveis" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
