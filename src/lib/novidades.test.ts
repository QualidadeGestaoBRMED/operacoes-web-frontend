import { describe, expect, it } from "vitest";
import {
  dataPorExtenso,
  destaquePendente,
  maisNovaQue,
  ordenar,
  visiveisPara,
  type NovidadeResumida,
} from "./novidades";

function novidade(id: string, extra: Partial<NovidadeResumida> = {}): NovidadeResumida {
  return {
    id,
    data: id.slice(0, 10),
    titulo: id,
    resumo: "",
    modulos: [],
    admin: false,
    destaque: false,
    imagem: null,
    ajuda: null,
    abrir: null,
    ...extra,
  };
}

describe("ordem das Novidades (STC-877)", () => {
  it("pela data e pelo número do dia, não pelo assunto", () => {
    expect(maisNovaQue("2026-10-26-02-a", "2026-10-26-01-z")).toBe(true);
    expect(maisNovaQue("2026-10-26-01-z", "2026-10-26-02-a")).toBe(false);
    expect(maisNovaQue("2026-10-26-01-a", "2026-10-26-01-b")).toBe(false);
    expect(maisNovaQue("2026-10-26-01-a", "")).toBe(true);
  });

  it("ordena da mais nova para a mais antiga", () => {
    const ids = ordenar([
      novidade("2026-10-20-01-b"),
      novidade("2026-10-26-01-z"),
      novidade("2026-10-26-02-a"),
    ]).map((n) => n.id);
    expect(ids).toEqual(["2026-10-26-02-a", "2026-10-26-01-z", "2026-10-20-01-b"]);
  });
});

describe("visiveisPara", () => {
  const todas = [
    novidade("2026-10-26-04-geral"),
    novidade("2026-10-26-03-rh", { modulos: ["gestao-rh"] }),
    novidade("2026-10-26-02-leg", { modulos: ["legalizacao"] }),
    novidade("2026-10-26-01-admin", { admin: true }),
  ];

  it("só as dos módulos que a pessoa acessa e as gerais", () => {
    expect(visiveisPara(todas, ["gestao-rh"], false).map((n) => n.id)).toEqual([
      "2026-10-26-04-geral",
      "2026-10-26-03-rh",
    ]);
  });

  it("as de Administração, só para quem administra", () => {
    expect(visiveisPara(todas, [], true).map((n) => n.id)).toContain("2026-10-26-01-admin");
    expect(visiveisPara(todas, [], false).map((n) => n.id)).not.toContain("2026-10-26-01-admin");
  });
});

describe("destaquePendente", () => {
  const visiveis = [
    novidade("2026-10-26-02-melhoria"),
    novidade("2026-10-26-01-celular", { destaque: true }),
    novidade("2026-10-20-01-antigo", { destaque: true }),
  ];

  it("o destaque mais novo ainda não visto", () => {
    expect(destaquePendente(visiveis, "")?.id).toBe("2026-10-26-01-celular");
    expect(destaquePendente(visiveis, "2026-10-21-01-x")?.id).toBe("2026-10-26-01-celular");
  });

  it("nenhum, se a pessoa já viu", () => {
    expect(destaquePendente(visiveis, "2026-10-26-01-celular")).toBeNull();
  });
});

it("data por extenso", () => {
  expect(dataPorExtenso("2026-10-26")).toBe("26 de outubro de 2026");
});
