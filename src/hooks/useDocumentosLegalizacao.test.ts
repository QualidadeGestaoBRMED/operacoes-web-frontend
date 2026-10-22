import { describe, expect, it } from "vitest";
import { ehChaveAfetadaPelaDesativacao } from "./useDocumentosLegalizacao";

describe("ehChaveAfetadaPelaDesativacao (STC-703, STC-853)", () => {
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
      expect(ehChaveAfetadaPelaDesativacao(chave)).toBe(true);
    }
  });

  it("não mexe no que não tem relação com o documento", () => {
    expect(ehChaveAfetadaPelaDesativacao(["tipos-documento"])).toBe(false);
    expect(ehChaveAfetadaPelaDesativacao("usuarios")).toBe(false);
    expect(ehChaveAfetadaPelaDesativacao(null)).toBe(false);
  });
});
