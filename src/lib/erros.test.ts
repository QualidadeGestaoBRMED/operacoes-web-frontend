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

  it("um 401 sempre vira a mensagem de sessão expirada, mesmo com corpo do SimpleJWT", () => {
    // Achado no review: o corpo real de um token inválido tem "detail" +
    // "code" (+ "messages") -- sem o tratamento especial de 401, isso virava
    // "O token informado não é válido para qualquer tipo de token
    // token_not_valid" na tela (achado no review).
    const erro = erroComResposta(
      {
        detail: "O token informado não é válido para qualquer tipo de token",
        code: "token_not_valid",
        messages: [{ token_class: "AccessToken", token_type: "access", message: "O token é inválido" }],
      },
      401,
    );
    expect(extrairMensagemErro(erro)).toBe(
      "Sua sessão expirou. Você será redirecionado para o login.",
    );
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
