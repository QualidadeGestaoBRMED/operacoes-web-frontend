import { describe, expect, it } from "vitest";
import { iniciaisDe, nomeExibicao } from "./utils";

describe("nomeExibicao", () => {
  it("junta first_name e last_name", () => {
    expect(
      nomeExibicao({ first_name: "Felipe", last_name: "Claudino", username: "felipe.claudino" }),
    ).toBe("Felipe Claudino");
  });

  it("cai pro username quando first_name/last_name estão vazios", () => {
    expect(nomeExibicao({ first_name: "", last_name: "", username: "felipe.claudino" })).toBe(
      "felipe.claudino",
    );
  });

  it("usa só o first_name quando last_name está vazio", () => {
    expect(nomeExibicao({ first_name: "Felipe", last_name: "", username: "felipe.claudino" })).toBe(
      "Felipe",
    );
  });
});

describe("iniciaisDe", () => {
  it("pega a primeira letra dos dois primeiros nomes", () => {
    expect(iniciaisDe("Felipe Claudino Ramos")).toBe("FC");
  });

  it("funciona com um nome só", () => {
    expect(iniciaisDe("Felipe")).toBe("F");
  });

  it("ignora espaços extras", () => {
    expect(iniciaisDe("  Felipe   Claudino  ")).toBe("FC");
  });

  it("devolve '?' pra uma string vazia", () => {
    expect(iniciaisDe("")).toBe("?");
    expect(iniciaisDe("   ")).toBe("?");
  });
});
