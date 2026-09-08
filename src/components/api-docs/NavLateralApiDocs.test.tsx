import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NavLateralApiDocs } from "./NavLateralApiDocs";
import type { OperacaoDoc } from "@/lib/openapi";

// >10 operações numa mesma tag, 2 recursos (recurso-a: 6, recurso-b: 5) --
// mesmo limiar (LIMIAR_SUBGRUPO_RECURSO) que faz a tag ganhar subtítulo de
// recurso na nav, condição real do achado do review.
function operacao(indice: number): OperacaoDoc {
  const recurso = indice < 6 ? "recurso-a" : "recurso-b";
  const letra = indice < 6 ? "A" : "B";
  const numero = indice < 6 ? indice : indice - 6;
  return {
    id: `op${indice}`,
    metodo: "get",
    path: `/x/${indice}/`,
    tag: "Grande",
    recurso,
    operation: { summary: `Operação ${letra}${numero}` },
  };
}

const OPERACOES = Array.from({ length: 11 }, (_, i) => operacao(i));
const GRUPOS = new Map([["Grande", OPERACOES]]);

function renderNav() {
  render(
    <NavLateralApiDocs
      grupos={GRUPOS}
      ativo={null}
      objetos={[]}
      temLimitesTaxa={false}
    />,
  );
}

describe("NavLateralApiDocs -- busca", () => {
  it("campo de busca tem rótulo acessível", () => {
    renderNav();
    expect(
      screen.getByRole("textbox", { name: /buscar endpoint/i }),
    ).toBeInTheDocument();
  });

  it("sem termo, mostra o subtítulo do recurso na 1ª operação de cada um", () => {
    renderNav();
    expect(screen.getByText("Recurso A")).toBeInTheDocument();
    expect(screen.getByText("Recurso B")).toBeInTheDocument();
  });

  it("busca que bate só com a 2ª+ operação de um recurso ainda mostra o subtítulo desse recurso", async () => {
    // Achado no review: o Set de cabeçalhos calculado sobre a lista
    // COMPLETA só marca a 1ª operação de cada recurso (op0 pra recurso-a);
    // "A3" bate só com op3 (3ª de recurso-a), que não carregava esse Set --
    // sem recalcular sobre a lista filtrada, o subtítulo "Recurso A" some.
    renderNav();
    await userEvent.type(
      screen.getByRole("textbox", { name: /buscar endpoint/i }),
      "A3",
    );
    expect(screen.getByText("Operação A3")).toBeInTheDocument();
    expect(screen.getByText("Recurso A")).toBeInTheDocument();
    expect(screen.queryByText("Operação A0")).not.toBeInTheDocument();
  });

  it("busca sem nenhum resultado mostra mensagem de vazio, não some em silêncio", async () => {
    renderNav();
    await userEvent.type(
      screen.getByRole("textbox", { name: /buscar endpoint/i }),
      "termo que não existe em nada",
    );
    expect(screen.getByText("Nenhum endpoint encontrado.")).toBeInTheDocument();
  });
});
