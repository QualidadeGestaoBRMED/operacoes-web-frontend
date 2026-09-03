import { describe, expect, it } from "vitest";
import { ordenarPor, type ExtratoresDeChave } from "./ordenacao";

interface Item {
  id: number;
  nome: string | null;
  pontos: number | null;
}

type Campo = "nome" | "pontos";

const chaves: ExtratoresDeChave<Item, Campo> = {
  nome: (item) => item.nome,
  pontos: (item) => item.pontos,
};

describe("ordenarPor", () => {
  it("devolve a mesma lista, sem reordenar, quando ordenacao é null", () => {
    const lista: Item[] = [
      { id: 1, nome: "Zeca", pontos: 1 },
      { id: 2, nome: "Ana", pontos: 2 },
    ];
    expect(ordenarPor(lista, null, chaves)).toEqual(lista);
  });

  it("não muta o array original (imutabilidade)", () => {
    const lista: Item[] = [
      { id: 1, nome: "Zeca", pontos: 1 },
      { id: 2, nome: "Ana", pontos: 2 },
    ];
    const original = [...lista];
    ordenarPor(lista, { campo: "nome", direcao: "asc" }, chaves);
    expect(lista).toEqual(original);
  });

  it("ordena chave string alfabeticamente, asc e desc", () => {
    const lista: Item[] = [
      { id: 1, nome: "Zeca", pontos: null },
      { id: 2, nome: "Ana", pontos: null },
    ];
    expect(ordenarPor(lista, { campo: "nome", direcao: "asc" }, chaves).map((i) => i.id)).toEqual([
      2, 1,
    ]);
    expect(ordenarPor(lista, { campo: "nome", direcao: "desc" }, chaves).map((i) => i.id)).toEqual([
      1, 2,
    ]);
  });

  it("ordena chave numérica, asc e desc", () => {
    const lista: Item[] = [
      { id: 1, nome: null, pontos: 30 },
      { id: 2, nome: null, pontos: 10 },
      { id: 3, nome: null, pontos: 20 },
    ];
    expect(
      ordenarPor(lista, { campo: "pontos", direcao: "asc" }, chaves).map((i) => i.id),
    ).toEqual([2, 3, 1]);
    expect(
      ordenarPor(lista, { campo: "pontos", direcao: "desc" }, chaves).map((i) => i.id),
    ).toEqual([1, 3, 2]);
  });

  it("joga chave null pro final, nas duas direções", () => {
    const lista: Item[] = [
      { id: 1, nome: null, pontos: 10 },
      { id: 2, nome: null, pontos: null },
      { id: 3, nome: null, pontos: 20 },
    ];
    expect(
      ordenarPor(lista, { campo: "pontos", direcao: "asc" }, chaves).map((i) => i.id),
    ).toEqual([1, 3, 2]);
    expect(
      ordenarPor(lista, { campo: "pontos", direcao: "desc" }, chaves).map((i) => i.id),
    ).toEqual([3, 1, 2]);
  });
});
