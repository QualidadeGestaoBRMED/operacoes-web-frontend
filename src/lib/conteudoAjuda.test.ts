import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artigosResumidos, lerArtigo, lerArtigos, PASTA_DA_AJUDA } from "./conteudoAjuda";
import { ICONES_DA_AJUDA } from "@/components/ajuda/iconesDaAjuda";
import { MODULOS_FUTUROS } from "@/config/modulos-futuros";
import { lerNovidades } from "./conteudoNovidades";

const VALIDO = `---
titulo: Como abrir uma demanda
resumo: Registre um pedido no quadro.
modulo: gestao-demandas
telas: [/modulos/gestao-demandas]
ordem: 1
---
1. Clique em **Nova Demanda**.
`;

afterEach(() => vi.restoreAllMocks());

describe("lerArtigo (STC-878)", () => {
  it("lê o cabeçalho e o texto; o endereço vem do nome do arquivo", () => {
    expect(lerArtigo("como-abrir-uma-demanda.md", VALIDO)).toEqual({
      slug: "como-abrir-uma-demanda",
      titulo: "Como abrir uma demanda",
      resumo: "Registre um pedido no quadro.",
      modulo: "gestao-demandas",
      admin: false,
      telas: ["/modulos/gestao-demandas"],
      ordem: 1,
      popular: false,
      icone: null,
      corpo: "1. Clique em **Nova Demanda**.",
    });
  });

  it("sem módulo, telas e ordem: geral, sem tela e no fim do grupo", () => {
    const lido = lerArtigo("primeiro-acesso.md", "---\ntitulo: T\nresumo: R\n---\n");
    expect(lido).toMatchObject({ modulo: null, telas: [], ordem: 100, popular: false });
  });

  it.each([
    ["Como_Abrir.md", VALIDO, /nome fora do formato/],
    ["x.md", "---\ntitulo: Só título\n---\n", /sem titulo ou resumo/],
    ["x.md", "---\ntitulo: T\nresumo: R\ntelas: /modulos/x\n---\n", /telas/],
    ["x.md", "---\ntitulo: T\nresumo: R\ntelas: [https://exemplo.com]\n---\n", /telas/],
    ["x.md", "---\ntitulo: T\nresumo: R\nordem: primeiro\n---\n", /ordem/],
  ])("recusa %s com o motivo", (arquivo, conteudo, motivo) => {
    expect(lerArtigo(arquivo, conteudo)).toMatch(motivo);
  });
});

describe("lerArtigos", () => {
  it("ignora o LEIAME e os inválidos (no log); o navegador recebe sem o texto", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "ajuda-"));
    fs.writeFileSync(path.join(pasta, "LEIAME.md"), "# instruções");
    fs.writeFileSync(path.join(pasta, "como-abrir-uma-demanda.md"), VALIDO);
    fs.writeFileSync(path.join(pasta, "Nome_Errado.md"), VALIDO);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const lidos = lerArtigos(pasta);

    expect(lidos.map((artigo) => artigo.slug)).toEqual(["como-abrir-uma-demanda"]);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("Nome_Errado.md"));
    expect(artigosResumidos(lidos)[0]).not.toHaveProperty("corpo");
  });

  it("todo arquivo da pasta de conteúdo é válido", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    lerArtigos(PASTA_DA_AJUDA);
    expect(erro).not.toHaveBeenCalled();
  });

  it("todo módulo citado na Ajuda e nas Novidades existe: um código errado esconderia a entrada de todos", () => {
    const codigos = new Set([
      "gestao-demandas",
      ...MODULOS_FUTUROS.flatMap((modulo) => (modulo.codigo ? [modulo.codigo] : [])),
    ]);
    const citados = [
      ...lerArtigos(PASTA_DA_AJUDA).flatMap((artigo) => (artigo.modulo ? [artigo.modulo] : [])),
      ...lerNovidades().flatMap((novidade) => novidade.modulos),
    ];
    expect(citados.filter((codigo) => !codigos.has(codigo))).toEqual([]);
  });

  it("todo ícone escolhido num artigo existe na lista", () => {
    const desconhecidos = lerArtigos(PASTA_DA_AJUDA)
      .filter((artigo) => artigo.icone && !Object.hasOwn(ICONES_DA_AJUDA, artigo.icone))
      .map((artigo) => `${artigo.slug}: ${artigo.icone}`);
    expect(desconhecidos).toEqual([]);
  });

  it('todo "Ver como usar" das Novidades leva a um artigo que existe', () => {
    const slugs = new Set(lerArtigos(PASTA_DA_AJUDA).map((artigo) => artigo.slug));
    const quebrados = lerNovidades()
      .filter((novidade) => novidade.ajuda && !slugs.has(novidade.ajuda))
      .map((novidade) => `${novidade.id} → ${novidade.ajuda}`);
    expect(quebrados).toEqual([]);
  });
});

describe("imagens da Ajuda", () => {
  const PASTA_DAS_IMAGENS = path.join(process.cwd(), "public", "ajuda");

  it("toda imagem citada existe e descreve o que mostra", () => {
    const citadas = lerArtigos(PASTA_DA_AJUDA).flatMap((artigo) =>
      [...artigo.corpo.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)].map(([, alt, caminho]) => ({ alt, caminho })),
    );
    const problemas = citadas.filter(
      ({ alt, caminho }) =>
        !alt.trim() || !caminho.startsWith("/") || !fs.existsSync(path.join(process.cwd(), "public", caminho)),
    );
    expect(problemas).toEqual([]);
  });

  it("nenhum arquivo passa de 1 MB (meta: até 500 KB)", () => {
    const arquivos = fs.existsSync(PASTA_DAS_IMAGENS) ? fs.readdirSync(PASTA_DAS_IMAGENS) : [];
    const pesados = arquivos.filter(
      (arquivo) => fs.statSync(path.join(PASTA_DAS_IMAGENS, arquivo)).size > 1024 * 1024,
    );
    expect(pesados).toEqual([]);
  });
});
