import { describe, expect, it } from "vitest";
import { ehChaveAfetadaPelaExclusao } from "./useDocumentosLegalizacao";

describe("ehChaveAfetadaPelaExclusao (STC-703)", () => {
  it("atualiza Matriz, Biblioteca, Kanban e avisos depois de excluir um documento", () => {
    for (const chave of [
      ["documentos-legalizacao", { unidade: 1 }],
      ["evidencias-vigentes", 1],
      ["demandas", {}],
      ["demanda", 102],
      ["resumo-demandas", {}],
      "alertas-pendentes",
      "notificacoes",
      "notificacoes-nao-lidas",
    ]) {
      expect(ehChaveAfetadaPelaExclusao(chave)).toBe(true);
    }
  });

  it("não mexe no que não tem relação com o documento", () => {
    expect(ehChaveAfetadaPelaExclusao(["tipos-documento"])).toBe(false);
    expect(ehChaveAfetadaPelaExclusao("usuarios")).toBe(false);
    expect(ehChaveAfetadaPelaExclusao(null)).toBe(false);
  });
});
