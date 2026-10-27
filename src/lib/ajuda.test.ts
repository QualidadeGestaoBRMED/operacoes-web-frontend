import { describe, expect, it } from "vitest";
import { agruparArtigos, artigosDaTela, artigosVisiveis, type ArtigoResumido } from "./ajuda";

function artigo(slug: string, extra: Partial<ArtigoResumido> = {}): ArtigoResumido {
  return { slug, titulo: slug, resumo: "", modulo: null, admin: false, telas: [], ordem: 100, popular: false, icone: null, ...extra };
}

const MODULOS = [
  { codigo: "gestao-demandas", nome: "Gestão de Demandas" },
  { codigo: "legalizacao", nome: "Legalização" },
];

describe("artigosVisiveis (STC-878)", () => {
  const ARTIGOS = [
    artigo("geral"),
    artigo("demanda", { modulo: "gestao-demandas" }),
    artigo("rh", { modulo: "gestao-rh" }),
    artigo("permissoes", { admin: true }),
  ];

  it("os gerais e os dos módulos que a pessoa acessa", () => {
    expect(artigosVisiveis(ARTIGOS, ["gestao-demandas"], false).map((a) => a.slug)).toEqual([
      "geral",
      "demanda",
    ]);
  });

  it("os de Administração, só para quem administra", () => {
    expect(artigosVisiveis(ARTIGOS, [], true).map((a) => a.slug)).toEqual(["geral", "permissoes"]);
  });
});

describe("agruparArtigos", () => {
  it("Primeiros passos, os módulos na ordem do menu e Administração; grupo vazio some", () => {
    const grupos = agruparArtigos(
      [
        artigo("permissoes", { admin: true }),
        artigo("mapa", { modulo: "legalizacao" }),
        artigo("geral"),
      ],
      MODULOS,
    );
    expect(grupos.map((grupo) => [grupo.titulo, grupo.artigos.map((a) => a.slug)])).toEqual([
      ["Primeiros passos", ["geral"]],
      ["Legalização", ["mapa"]],
      ["Administração", ["permissoes"]],
    ]);
  });

  it("dentro do grupo: pela ordem e, empatando, pelo título", () => {
    const [grupo] = agruparArtigos(
      [artigo("b", { titulo: "Bom" }), artigo("c", { titulo: "Abrir", ordem: 2 }), artigo("a", { titulo: "Antes" })],
      [],
    );
    expect(grupo.artigos.map((a) => a.slug)).toEqual(["c", "a", "b"]);
  });
});

describe("artigosDaTela", () => {
  const ARTIGOS = [
    artigo("legalizacao", { telas: ["/modulos/legalizacao/*"] }),
    artigo("mapa", { telas: ["/modulos/legalizacao/mapa"] }),
    artigo("cores", { telas: ["/modulos/legalizacao/mapa"], ordem: 1 }),
  ];

  it("vale a tela mais específica; empatando, todos, em ordem", () => {
    expect(artigosDaTela(ARTIGOS, "/modulos/legalizacao/mapa").map((a) => a.slug)).toEqual([
      "cores",
      "mapa",
    ]);
    expect(artigosDaTela(ARTIGOS, "/modulos/legalizacao/biblioteca").map((a) => a.slug)).toEqual([
      "legalizacao",
    ]);
  });

  it("sem /*, a tela vale só para ela: o Painel não aparece em Horas Extras", () => {
    const painel = [artigo("painel", { telas: ["/modulos/gestao-rh"] })];
    expect(artigosDaTela(painel, "/modulos/gestao-rh").map((a) => a.slug)).toEqual(["painel"]);
    expect(artigosDaTela(painel, "/modulos/gestao-rh/horas-extras")).toEqual([]);
  });

  it("a tela exata ganha da com /* de mesmo começo", () => {
    const artigos = [artigo("modulo", { telas: ["/modulos/gestao-rh/*"] }), artigo("painel", { telas: ["/modulos/gestao-rh"] })];
    expect(artigosDaTela(artigos, "/modulos/gestao-rh").map((a) => a.slug)).toEqual(["painel"]);
    expect(artigosDaTela(artigos, "/modulos/gestao-rh/ferias").map((a) => a.slug)).toEqual(["modulo"]);
  });

  it("só o caminho inteiro conta: /modulos/legalizacao/* não vale para /modulos/legalizacao-x", () => {
    expect(artigosDaTela(ARTIGOS, "/modulos/legalizacao-x")).toEqual([]);
    expect(artigosDaTela(ARTIGOS, "/modulos/gestao-rh")).toEqual([]);
  });
});
