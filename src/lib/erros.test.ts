import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { extrairMensagemErro } from "./erros";

function erroComResposta(data: unknown, status = 400): AxiosError {
  const response = { data, status } as AxiosResponse;
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, response);
}

describe("extrairMensagemErro", () => {
  it("extrai a primeira mensagem de um erro por campo (formato DRF)", () => {
    const erro = erroComResposta({ titulo: ["Este campo é obrigatório."] });
    expect(extrairMensagemErro(erro)).toBe("Este campo é obrigatório.");
  });

  it("junta mensagens de múltiplos campos", () => {
    const erro = erroComResposta({
      titulo: ["Este campo é obrigatório."],
      prioridade: ["Valor inválido."],
    });
    expect(extrairMensagemErro(erro)).toBe("Este campo é obrigatório. Valor inválido.");
  });

  it("extrai non_field_errors", () => {
    const erro = erroComResposta({ non_field_errors: ["A demanda já está nesse status."] });
    expect(extrairMensagemErro(erro)).toBe("A demanda já está nesse status.");
  });

  it("extrai detail de um 403/404 do DRF", () => {
    const erro = erroComResposta({ detail: "Não encontrado." });
    expect(extrairMensagemErro(erro)).toBe("Não encontrado.");
  });

  it("aceita corpo de resposta que já é uma string", () => {
    const erro = erroComResposta("Erro interno do servidor.");
    expect(extrairMensagemErro(erro)).toBe("Erro interno do servidor.");
  });

  it("usa a mensagem do próprio erro quando não há corpo de resposta (erro de rede)", () => {
    const erro = new AxiosError("Network Error", "ERR_NETWORK");
    expect(extrairMensagemErro(erro)).toBe("Network Error");
  });

  it("cai na mensagem padrão pra um erro que não é do axios", () => {
    expect(extrairMensagemErro(new Error("qualquer coisa"))).toBe(
      "Não foi possível completar a operação. Tente novamente.",
    );
    expect(extrairMensagemErro("string solta")).toBe(
      "Não foi possível completar a operação. Tente novamente.",
    );
  });
});
