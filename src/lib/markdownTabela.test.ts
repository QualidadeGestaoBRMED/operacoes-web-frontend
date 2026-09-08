import { describe, expect, it } from "vitest";
import {
  celulaEhCodigo,
  extrairTabelaMarkdown,
  textoDaCelula,
} from "./markdownTabela";

const TEXTO = `
## Limites de taxa

Alguns endpoints têm limite de requisições por usuário/IP.

| Endpoint | Limite |
|---|---|
| \`POST /api/auth/google/\` | 10/min |
| Escrita em demandas (criar, editar) | 60/min |
`;

describe("extrairTabelaMarkdown", () => {
  it("extrai as linhas da tabela, pulando a linha separadora", () => {
    const linhas = extrairTabelaMarkdown(TEXTO);
    expect(linhas).toEqual([
      ["Endpoint", "Limite"],
      ["`POST /api/auth/google/`", "10/min"],
      ["Escrita em demandas (criar, editar)", "60/min"],
    ]);
  });

  it("null quando não tem tabela nenhuma", () => {
    expect(
      extrairTabelaMarkdown("só um texto qualquer, sem pipe nenhum"),
    ).toBeNull();
  });

  it("null quando o texto é undefined", () => {
    expect(extrairTabelaMarkdown(undefined)).toBeNull();
  });
});

describe("celulaEhCodigo / textoDaCelula", () => {
  it("célula inteira entre backticks é código", () => {
    expect(celulaEhCodigo("`POST /api/auth/google/`")).toBe(true);
    expect(textoDaCelula("`POST /api/auth/google/`")).toBe(
      "POST /api/auth/google/",
    );
  });

  it("texto comum não é código", () => {
    expect(celulaEhCodigo("Escrita em demandas")).toBe(false);
    expect(textoDaCelula("Escrita em demandas")).toBe("Escrita em demandas");
  });
});
