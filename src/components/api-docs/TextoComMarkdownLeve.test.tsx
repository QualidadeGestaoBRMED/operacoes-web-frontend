import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextoComMarkdownLeve } from "./TextoComMarkdownLeve";

describe("TextoComMarkdownLeve", () => {
  it("undefined/vazio não renderiza nada", () => {
    const { container: semTexto } = render(
      <TextoComMarkdownLeve texto={undefined} />,
    );
    expect(semTexto).toBeEmptyDOMElement();

    const { container: vazio } = render(<TextoComMarkdownLeve texto="" />);
    expect(vazio).toBeEmptyDOMElement();
  });

  it("prosa sem crase renderiza como texto puro", () => {
    const { container } = render(
      <TextoComMarkdownLeve texto="Retorna os dados completos de uma demanda." />,
    );
    expect(container).toHaveTextContent(
      "Retorna os dados completos de uma demanda.",
    );
    expect(container.querySelector("code")).toBeNull();
  });

  it("trecho entre crases vira <code>, sem crase visível no texto", () => {
    const { container } = render(
      <TextoComMarkdownLeve texto="Aceita o filtro `?status=<valor>` combinável." />,
    );
    const codigo = container.querySelector("code");
    expect(codigo?.textContent).toBe("?status=<valor>");
    expect(container.textContent).not.toContain("`");
  });

  it("lista de choices (linhas '* `valor` - Rótulo') vira <ul>/<li>, não texto colapsado numa linha só", () => {
    // Formato real gerado pelo drf-spectacular pra campo enum (ex.
    // StatusDocumentoUnidadeEnum) -- achado no review: sem isso, as
    // quebras de linha somem e o `código`/asterisco aparecem literais.
    const texto =
      "* `nao_iniciado` - Não iniciado\n* `em_andamento` - Em andamento\n* `protocolado` - Protocolado";
    const { container } = render(<TextoComMarkdownLeve texto={texto} />);
    const itens = container.querySelectorAll("li");
    expect(itens).toHaveLength(3);
    expect(itens[0].querySelector("code")?.textContent).toBe("nao_iniciado");
    expect(itens[0].textContent).toBe("nao_iniciado - Não iniciado");
    expect(container.textContent).not.toContain("*");
  });

  it("prosa com múltiplas linhas (sem ser lista) preserva quebra visual via <br>", () => {
    const { container } = render(
      <TextoComMarkdownLeve texto={"Primeira linha.\nSegunda linha."} />,
    );
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
  });
});
