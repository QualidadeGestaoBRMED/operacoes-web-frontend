import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoteImportacao } from "@/lib/gestaoRHImportacao";
import { AbaImportacao } from "./AbaImportacao";

vi.mock("@/lib/gestaoRHImportacao", async (original) => ({
  ...(await original<typeof import("@/lib/gestaoRHImportacao")>()),
  listarImportacoes: vi.fn(),
  importarRelatorios: vi.fn(),
  listarLinhasRejeitadas: vi.fn(),
}));

import { importarRelatorios, listarImportacoes, listarLinhasRejeitadas } from "@/lib/gestaoRHImportacao";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function arquivo(nome: string, bytes = 1024) {
  return new File([new Uint8Array(bytes)], nome, { type: XLSX });
}

function lote(extra: Partial<LoteImportacao> = {}): LoteImportacao {
  return {
    id: 1,
    origem: "planilha",
    status: "concluida",
    motivo_recusa: "",
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-10-12",
    linhas_processadas: 11668,
    linhas_rejeitadas: 0,
    obtido_em: "2026-10-13T10:00:00Z",
    concluido_em: "2026-10-13T10:00:06Z",
    enviado_por: "Nathalya Almeida",
    equipes_novas: [],
    ...extra,
  };
}

function erroHttp(status: number, data: unknown) {
  return new AxiosError("erro", String(status), undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

function renderAba() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AbaImportacao />
    </SWRConfig>,
  );
}

async function escolherOs3(user: ReturnType<typeof userEvent.setup>, bytes = 1024) {
  await user.upload(screen.getByLabelText("Arquivo de Jornada"), arquivo("jornada.xlsx", bytes));
  await user.upload(screen.getByLabelText("Arquivo de Abonos"), arquivo("abonos.xlsx", bytes));
  await user.upload(screen.getByLabelText("Arquivo de Pendências"), arquivo("pendencias.xlsx", bytes));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarImportacoes).mockResolvedValue([]);
  // Só o relógio: periodoPadrao parte de "hoje".
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 13, 9, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Aba Importação: formulário", () => {
  it("abre com o período do robô, os 3 relatórios e o histórico vazio", async () => {
    renderAba();
    expect(screen.getByLabelText("Início do período *")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Fim do período *")).toHaveValue("2026-10-12");
    for (const rotulo of ["Jornada", "Abonos", "Pendências"]) {
      expect(screen.getByRole("button", { name: `Selecionar ${rotulo}` })).toBeEnabled();
    }
    expect(await screen.findByText("Nenhuma importação ainda.")).toBeInTheDocument();
  });

  it("período padrão em janeiro volta para dezembro do ano anterior", async () => {
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0));
    renderAba();
    expect(screen.getByLabelText("Início do período *")).toHaveValue("2026-12-01");
    expect(screen.getByLabelText("Fim do período *")).toHaveValue("2026-12-31");
    await screen.findByText("Nenhuma importação ainda.");
  });

  it("sem os 3 arquivos não envia e aponta o que falta", async () => {
    const user = userEvent.setup();
    renderAba();
    await user.upload(screen.getByLabelText("Arquivo de Jornada"), arquivo("jornada.xlsx"));
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(await screen.findByText("Escolha o relatório de Abonos.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o relatório de Pendências.")).toBeInTheDocument();
    expect(screen.getByLabelText("Arquivo de Abonos")).toHaveAccessibleDescription(
      "Escolha o relatório de Abonos.",
    );
    expect(screen.getByText("jornada.xlsx")).toBeInTheDocument();
    expect(importarRelatorios).not.toHaveBeenCalled();
  });

  it("recusa arquivo que não é XLSX", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAba();
    await user.upload(
      screen.getByLabelText("Arquivo de Jornada"),
      new File(["x"], "jornada.xls", { type: "application/vnd.ms-excel" }),
    );
    expect(await screen.findByText("Envie o relatório em XLSX.")).toBeInTheDocument();
    expect(screen.queryByText("jornada.xls")).not.toBeInTheDocument();
  });

  it("fim antes do início não envia", async () => {
    const user = userEvent.setup();
    renderAba();
    await escolherOs3(user);
    const fim = screen.getByLabelText("Fim do período *");
    await user.clear(fim);
    await user.type(fim, "2026-08-31");
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(
      await screen.findByText("O fim do período não pode ser antes do início."),
    ).toBeInTheDocument();
    expect(importarRelatorios).not.toHaveBeenCalled();
  });

  it("acima do limite do envio pela tela, avisa em vez de enviar", async () => {
    const user = userEvent.setup();
    renderAba();
    await escolherOs3(user, 1.5 * 1024 * 1024);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(await screen.findByText(/Os 3 arquivos somam 4\.5 MB/)).toBeInTheDocument();
    expect(importarRelatorios).not.toHaveBeenCalled();
  });

  it("remover um arquivo volta o cartão ao estado vazio", async () => {
    const user = userEvent.setup();
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Remover o arquivo de Abonos" }));
    expect(screen.queryByText("abonos.xlsx")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar Abonos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar Jornada" })).toBeInTheDocument();
  });
});

describe("Aba Importação: envio", () => {
  it("envia os 3 arquivos com o período e mostra o resultado", async () => {
    const user = userEvent.setup();
    let concluir: (valor: LoteImportacao) => void = () => {};
    vi.mocked(importarRelatorios).mockReturnValue(
      new Promise((resolver) => {
        concluir = resolver;
      }),
    );
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(screen.getByRole("button", { name: "Importando..." })).toBeDisabled();
    const [arquivos, inicio, fim] = vi.mocked(importarRelatorios).mock.calls[0];
    expect(Object.fromEntries(Object.entries(arquivos).map(([chave, valor]) => [chave, valor.name]))).toEqual({
      jornada: "jornada.xlsx",
      abonos: "abonos.xlsx",
      pendencias: "pendencias.xlsx",
    });
    expect([inicio, fim]).toEqual(["2026-09-01", "2026-10-12"]);

    vi.mocked(listarImportacoes).mockResolvedValue([lote({ linhas_rejeitadas: 2 })]);
    concluir(lote({ linhas_rejeitadas: 2, equipes_novas: [{ id: 9, nome: "RIO GALEAO" }] }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(
      "Importação concluída: 01/09/2026 a 12/10/2026, 11.668 linhas processadas.",
    );
    expect(status).toHaveTextContent("2 linhas rejeitadas.");
    expect(status).toHaveTextContent("1 equipe nova sem categoria: classifique na aba Equipes.");
    // Concluída: os cartões voltam vazios para o próximo envio.
    expect(screen.getByRole("button", { name: "Selecionar Jornada" })).toBeInTheDocument();
    // O histórico é recarregado com o lote novo.
    expect(await screen.findByRole("button", { name: /Ver 2 linhas rejeitadas/ })).toBeInTheDocument();
  });

  it("lote recusado mostra o motivo e mantém os arquivos", async () => {
    const user = userEvent.setup();
    vi.mocked(importarRelatorios).mockResolvedValue(
      lote({
        status: "recusada",
        motivo_recusa: "Jornada: o período do relatório é diferente do informado.",
        linhas_processadas: 0,
      }),
    );
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Importação recusada: nada foi gravado.");
    expect(alerta).toHaveTextContent("Jornada: o período do relatório é diferente do informado.");
    expect(screen.getByText("jornada.xlsx")).toBeInTheDocument();
  });

  it("erro 400 de um arquivo aparece no cartão dele", async () => {
    const user = userEvent.setup();
    vi.mocked(importarRelatorios).mockRejectedValue(
      erroHttp(400, { abonos: ["Arquivo maior que 15 MB."] }),
    );
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(await screen.findByText("Arquivo maior que 15 MB.")).toBeInTheDocument();
    expect(screen.getByLabelText("Arquivo de Abonos")).toHaveAccessibleDescription(
      "Arquivo maior que 15 MB.",
    );
  });

  it("outra importação em andamento (409) vira mensagem geral", async () => {
    const user = userEvent.setup();
    vi.mocked(importarRelatorios).mockRejectedValue(
      erroHttp(409, { detail: "Outra importação em andamento; tente de novo em instantes." }),
    );
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(
      await screen.findByText("Outra importação em andamento; tente de novo em instantes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar relatórios" })).toBeEnabled();
  });
});

describe("Aba Importação: resultado incerto", () => {
  it.each([
    ["tempo esgotado no proxy (504)", erroHttp(504, "FUNCTION_INVOCATION_TIMEOUT")],
    ["sem resposta (rede)", new AxiosError("Network Error", "ERR_NETWORK")],
  ])("%s pede para conferir o histórico e o recarrega", async (_caso, erro) => {
    const user = userEvent.setup();
    vi.mocked(importarRelatorios).mockRejectedValue(erro);
    renderAba();
    await escolherOs3(user);
    await screen.findByText("Nenhuma importação ainda.");
    vi.mocked(listarImportacoes).mockResolvedValue([lote()]);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));

    expect(
      await screen.findByText(/A importação pode ter sido concluída: confira o histórico/),
    ).toBeInTheDocument();
    expect(screen.queryByText("FUNCTION_INVOCATION_TIMEOUT")).not.toBeInTheDocument();
    // O lote que o backend concluiu aparece sem recarregar a página.
    expect(await screen.findByText("Manual · Nathalya Almeida")).toBeInTheDocument();
  });

  it("escolher outro arquivo tira o resultado do envio anterior", async () => {
    const user = userEvent.setup();
    vi.mocked(importarRelatorios).mockResolvedValue(
      lote({ status: "recusada", motivo_recusa: "Período diferente do informado." }),
    );
    renderAba();
    await escolherOs3(user);
    await user.click(screen.getByRole("button", { name: "Importar relatórios" }));
    expect(await screen.findByText("Importação recusada: nada foi gravado.")).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Arquivo de Jornada"), arquivo("jornada-2.xlsx"));
    expect(screen.queryByText("Importação recusada: nada foi gravado.")).not.toBeInTheDocument();
  });
});

describe("Aba Importação: histórico", () => {
  it("mostra origem, situação, motivo da recusa e equipes novas", async () => {
    vi.mocked(listarImportacoes).mockResolvedValue([
      lote({ id: 3, origem: "robo", enviado_por: null, equipes_novas: [{ id: 1, nome: "A" }, { id: 2, nome: "B" }] }),
      lote({ id: 2, status: "recusada", motivo_recusa: "Abonos: falta a coluna Status.", linhas_processadas: 0 }),
    ]);
    renderAba();

    const tabela = await screen.findByRole("table", { name: "Importações" });
    const [, robo, manual] = within(tabela).getAllByRole("row");
    expect(robo).toHaveTextContent("Robô");
    expect(robo).toHaveTextContent("Concluída");
    expect(robo).toHaveTextContent("2 equipes novas sem categoria");
    expect(manual).toHaveTextContent("Manual · Nathalya Almeida");
    expect(manual).toHaveTextContent("Recusada");
    expect(manual).toHaveTextContent("Abonos: falta a coluna Status.");
  });

  it("\"N · ver\" abre as linhas rejeitadas do lote", async () => {
    const user = userEvent.setup();
    vi.mocked(listarImportacoes).mockResolvedValue([lote({ id: 7, linhas_rejeitadas: 2 })]);
    vi.mocked(listarLinhasRejeitadas).mockResolvedValue([
      { relatorio: "jornada", linha: 42, colaborador: "FULANO DE TAL", motivo: "Nome repetido em duas equipes." },
      { relatorio: "abonos", linha: 7, colaborador: "", motivo: "Data inválida." },
    ]);
    renderAba();

    await user.click(await screen.findByRole("button", { name: /Ver 2 linhas rejeitadas/ }));

    const modal = await screen.findByRole("dialog", { name: "Linhas rejeitadas" });
    await waitFor(() => expect(listarLinhasRejeitadas).toHaveBeenCalledWith(7));
    const linhas = await within(modal).findAllByRole("row");
    expect(linhas[1]).toHaveTextContent("Jornada42FULANO DE TALNome repetido em duas equipes.");
    expect(linhas[2]).toHaveTextContent("Abonos7Sem identificaçãoData inválida.");
  });

  it("lote com muitas linhas rejeitadas mostra só as 500 primeiras", async () => {
    const user = userEvent.setup();
    vi.mocked(listarImportacoes).mockResolvedValue([lote({ id: 8, linhas_rejeitadas: 1200 })]);
    vi.mocked(listarLinhasRejeitadas).mockResolvedValue(
      Array.from({ length: 1200 }, (_, i) => ({
        relatorio: "jornada" as const,
        linha: i + 2,
        colaborador: "",
        motivo: "Data inválida.",
      })),
    );
    renderAba();

    await user.click(await screen.findByRole("button", { name: /Ver 1200 linhas rejeitadas/ }));
    const modal = await screen.findByRole("dialog", { name: "Linhas rejeitadas" });
    expect(await within(modal).findByText("Mostrando as 500 primeiras de 1.200 linhas rejeitadas.")).toBeInTheDocument();
    // Cabeçalho + 500 linhas.
    expect(within(modal).getAllByRole("row")).toHaveLength(501);
  });

  it("falha ao carregar o histórico permite tentar de novo", async () => {
    const user = userEvent.setup();
    vi.mocked(listarImportacoes).mockRejectedValueOnce(erroHttp(500, { detail: "Erro no servidor." }));
    renderAba();

    expect(await screen.findByText("Erro no servidor.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma importação ainda.")).toBeInTheDocument();
  });
});
