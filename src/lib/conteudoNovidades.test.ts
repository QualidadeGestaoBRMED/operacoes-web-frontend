import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lerNovidade, lerNovidades, PASTA_DAS_NOVIDADES, resumidas } from "./conteudoNovidades";

const VALIDA = `---
titulo: Notificações no celular
resumo: Agora o Atlas avisa no celular.
modulos: [gestao-rh]
destaque: true
ajuda: notificacoes-no-celular
---
Texto **em Markdown**.
`;

afterEach(() => vi.restoreAllMocks());

describe("lerNovidade (STC-877)", () => {
  it("lê o cabeçalho e o texto; a data vem do nome do arquivo", () => {
    expect(lerNovidade("2026-10-26-01-notificacoes-no-celular.md", VALIDA)).toEqual({
      id: "2026-10-26-01-notificacoes-no-celular",
      data: "2026-10-26",
      titulo: "Notificações no celular",
      resumo: "Agora o Atlas avisa no celular.",
      modulos: ["gestao-rh"],
      admin: false,
      destaque: true,
      imagem: null,
      ajuda: "notificacoes-no-celular",
      corpo: "Texto **em Markdown**.",
    });
  });

  it.each([
    ["2026-10-26-celular.md", VALIDA, /nome fora do formato/],
    ["2026-10-26-01-celular.md", "---\ntitulo: Só título\n---\n", /sem titulo ou resumo/],
    ["2026-10-26-01-celular.md", "---\ntitulo: T\nresumo: R\nmodulos: gestao-rh\n---\n", /lista/],
  ])("recusa %s com o motivo", (arquivo, conteudo, motivo) => {
    expect(lerNovidade(arquivo, conteudo)).toMatch(motivo);
  });
});

describe("lerNovidades", () => {
  it("ignora o LEIAME e os inválidos (no log), da mais nova para a mais antiga", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "novidades-"));
    fs.writeFileSync(path.join(pasta, "LEIAME.md"), "# instruções");
    fs.writeFileSync(path.join(pasta, "2026-10-20-01-antiga.md"), VALIDA);
    fs.writeFileSync(path.join(pasta, "2026-10-26-01-nova.md"), VALIDA);
    fs.writeFileSync(path.join(pasta, "nome-errado.md"), VALIDA);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const lidas = lerNovidades(pasta);

    expect(lidas.map((n) => n.id)).toEqual(["2026-10-26-01-nova", "2026-10-20-01-antiga"]);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("nome-errado.md"));
    expect(resumidas(lidas)[0]).not.toHaveProperty("corpo");
  });

  it("todo arquivo da pasta de conteúdo é válido", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    lerNovidades(PASTA_DAS_NOVIDADES);
    expect(erro).not.toHaveBeenCalled();
  });
});
