import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import { ExportarSituacaoModal } from "./ExportarSituacaoModal";

const sessao = vi.hoisted(() => ({
  atual: {} as Record<string, unknown>,
  rede: { rede: "padrao", podeEscolher: true },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => sessao.atual }));
vi.mock("@/hooks/useRedeDaLegalizacao", () => ({ useRedeDaLegalizacao: () => sessao.rede }));

const UNIDADES: Unidade[] = [
  { id: 1, nome: "Barra", codigo: "BAR", cidade: "Rio", ativa: true, rede: "padrao" },
  { id: 2, nome: "Centro", codigo: "CEN", cidade: "Rio", ativa: true, rede: "padrao" },
  { id: 3, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true, rede: "padrao" },
] as Unidade[];
const lista = vi.hoisted(() => ({
  atual: { isLoading: false, error: undefined as unknown, vazia: false },
}));
vi.mock("@/hooks/useUnidades", () => ({
  useUnidades: () => ({
    unidades: lista.atual.isLoading || lista.atual.error || lista.atual.vazia ? [] : UNIDADES,
    isLoading: lista.atual.isLoading,
    error: lista.atual.error,
  }),
}));

vi.mock("@/lib/legalizacaoExportacao", async (original) => ({
  ...(await original<typeof import("@/lib/legalizacaoExportacao")>()),
  exportarSituacao: vi.fn(),
}));
vi.mock("@/lib/download", () => ({ baixarArquivo: vi.fn() }));
import { baixarArquivo } from "@/lib/download";
import { exportarSituacao } from "@/lib/legalizacaoExportacao";

const ADMIN = { user: { usuarioId: 7 }, isCoordenacaoUnidade: false };
const ARQUIVO = { arquivo: new Blob(["x"]), nome: "situacao-legalizacao_todos_2026-11-03.xlsx" };

function abrir(aoFechar = vi.fn()) {
  render(<ExportarSituacaoModal aberto aoFechar={aoFechar} />);
  return aoFechar;
}

beforeEach(() => {
  lista.atual = { isLoading: false, error: undefined, vazia: false };
  window.localStorage.clear();
  sessao.atual = ADMIN;
  sessao.rede = { rede: "padrao", podeEscolher: true };
  vi.mocked(exportarSituacao).mockReset().mockResolvedValue(ARQUIVO);
  vi.mocked(baixarArquivo).mockReset();
});

describe("ExportarSituacaoModal (STC-963)", () => {
  it("exporta com o padrão: todos, todas as unidades e categorias e as colunas marcadas", async () => {
    const aoFechar = abrir();

    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(exportarSituacao).toHaveBeenCalledWith({
      recorte: "todos",
      unidades: [],
      categorias: [],
      colunas: ["dias_para_vencer", "responsavel", "area_responsavel", "renovacao"],
      rede: "padrao",
    });
    expect(baixarArquivo).toHaveBeenCalledWith(ARQUIVO);
    expect(aoFechar).toHaveBeenCalled();
  });

  it("leva o recorte, as unidades, as categorias e as colunas escolhidas", async () => {
    abrir();

    await userEvent.click(screen.getByLabelText("Só os não cadastrados"));
    const unidades = screen.getByRole("group", { name: "Unidades" }).closest("fieldset")!;
    await userEvent.click(within(unidades).getByLabelText("Escolher"));
    await userEvent.click(screen.getByLabelText("Centro"));
    await userEvent.click(screen.getByLabelText("Niterói"));
    const categorias = screen.getByRole("group", { name: "Categorias" }).closest("fieldset")!;
    await userEvent.click(within(categorias).getByLabelText("Escolher"));
    await userEvent.click(screen.getByLabelText("Equipamentos"));
    await userEvent.click(screen.getByLabelText("Responsável operacional"));
    await userEvent.click(screen.getByLabelText("Link no Atlas"));
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(exportarSituacao).toHaveBeenCalledWith({
      recorte: "nao_cadastrados",
      unidades: [2, 3],
      categorias: ["equipamentos"],
      colunas: ["dias_para_vencer", "area_responsavel", "renovacao", "link"],
      rede: "padrao",
    });
  });

  it("escolher sem marcar nada não deixa exportar", async () => {
    abrir();
    const unidades = screen.getByRole("group", { name: "Unidades" }).closest("fieldset")!;

    await userEvent.click(within(unidades).getByLabelText("Escolher"));

    expect(screen.getByRole("button", { name: /^exportar$/i })).toBeDisabled();
  });

  it("coordenação com uma unidade fica travada nela", () => {
    sessao.atual = { user: { usuarioId: 8, unidade_id: 2 }, isCoordenacaoUnidade: true };
    abrir();

    expect(screen.queryByRole("group", { name: "Unidades" })).not.toBeInTheDocument();
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.queryByText("Barra")).not.toBeInTheDocument();
  });

  it("coordenação com mais de uma unidade só escolhe entre as dela", async () => {
    sessao.atual = {
      user: { usuarioId: 8, unidade_id: 2, unidades_adicionais_ids: [3] },
      isCoordenacaoUnidade: true,
    };
    abrir();
    const unidades = screen.getByRole("group", { name: "Unidades" }).closest("fieldset")!;

    await userEvent.click(within(unidades).getByLabelText("Escolher"));

    expect(screen.getByLabelText("Centro")).toBeInTheDocument();
    expect(screen.getByLabelText("Niterói")).toBeInTheDocument();
    expect(screen.queryByLabelText("Barra")).not.toBeInTheDocument();
  });

  it("lembra as colunas da última exportação, por pessoa", async () => {
    const { unmount } = render(<ExportarSituacaoModal aberto aoFechar={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Justificativa"));
    await userEvent.click(screen.getByLabelText("Dias para vencer"));
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalled());
    unmount();

    const segunda = render(<ExportarSituacaoModal aberto aoFechar={vi.fn()} />);
    expect(screen.getByLabelText("Justificativa")).toBeChecked();
    expect(screen.getByLabelText("Dias para vencer")).not.toBeChecked();
    segunda.unmount();

    sessao.atual = { user: { usuarioId: 99 }, isCoordenacaoUnidade: false };
    abrir();
    expect(screen.getByLabelText("Dias para vencer")).toBeChecked();
  });

  it("quem vê as duas redes exporta a da tela ou as duas juntas", async () => {
    abrir();

    expect(screen.getByLabelText("Rede própria (a da tela)")).toBeChecked();
    await userEvent.click(screen.getByLabelText("As duas redes"));
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(vi.mocked(exportarSituacao).mock.calls[0][0].rede).toBeUndefined();
  });

  it("trocar a rede limpa as unidades escolhidas", async () => {
    abrir();
    const unidades = screen.getByRole("group", { name: "Unidades" }).closest("fieldset")!;
    await userEvent.click(within(unidades).getByLabelText("Escolher"));
    await userEvent.click(screen.getByLabelText("Centro"));

    await userEvent.click(screen.getByLabelText("As duas redes"));
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(vi.mocked(exportarSituacao).mock.calls[0][0].unidades).toEqual([]);
  });

  it("quem vê uma rede só não escolhe rede", () => {
    sessao.rede = { rede: "padrao", podeEscolher: false };
    abrir();
    expect(screen.queryByLabelText("As duas redes")).not.toBeInTheDocument();
  });

  it("coluna Rede só para quem vê as duas redes", () => {
    abrir();
    expect(screen.getByLabelText("Rede")).toBeInTheDocument();
  });

  it("quem vê uma rede só não tem a coluna Rede, nem a manda lembrada", async () => {
    window.localStorage.setItem(
      "atlas.legalizacao.exportacao.colunas.7",
      JSON.stringify(["rede", "justificativa"]),
    );
    sessao.rede = { rede: "padrao", podeEscolher: false };
    abrir();

    expect(screen.queryByLabelText("Rede")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));
    expect(vi.mocked(exportarSituacao).mock.calls[0][0].colunas).toEqual(["justificativa"]);
  });

  it("não fecha pelo Esc enquanto exporta", async () => {
    let terminar: (arquivo: typeof ARQUIVO) => void = () => {};
    vi.mocked(exportarSituacao).mockReturnValue(
      new Promise((resolver) => {
        terminar = resolver;
      }),
    );
    const aoFechar = abrir();

    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));
    await userEvent.keyboard("{Escape}");
    expect(aoFechar).not.toHaveBeenCalled();

    terminar(ARQUIVO);
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledWith(ARQUIVO));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("desmarcar todas as colunas exporta só as fixas e lembra assim", async () => {
    const { unmount } = render(<ExportarSituacaoModal aberto aoFechar={vi.fn()} />);
    for (const rotulo of [
      "Dias para vencer",
      "Responsável operacional",
      "Área responsável",
      "Renovação",
    ]) {
      await userEvent.click(screen.getByLabelText(rotulo));
    }
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(vi.mocked(exportarSituacao).mock.calls[0][0].colunas).toEqual([]);
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalled());
    unmount();

    abrir();
    expect(screen.getByLabelText("Dias para vencer")).not.toBeChecked();
    expect(screen.getByLabelText("Responsável operacional")).not.toBeChecked();
  });

  it("lista de unidades carregando: aviso no lugar das caixas", async () => {
    lista.atual = { isLoading: true, error: undefined, vazia: false };
    abrir();
    const unidades = screen.getByText("Unidades").closest("fieldset")!;

    await userEvent.click(within(unidades).getByLabelText("Escolher"));

    expect(within(unidades).getByText("Carregando unidades…")).toBeInTheDocument();
  });

  it("lista de unidades com erro: aviso, e Todas continua exportando", async () => {
    lista.atual = { isLoading: false, error: new Error("falhou"), vazia: false };
    abrir();
    const unidades = screen.getByText("Unidades").closest("fieldset")!;

    await userEvent.click(within(unidades).getByLabelText("Escolher"));
    expect(within(unidades).getByText(/Não foi possível carregar as unidades/)).toBeInTheDocument();

    await userEvent.click(within(unidades).getByLabelText("Todas"));
    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));
    expect(vi.mocked(exportarSituacao).mock.calls[0][0].unidades).toEqual([]);
  });

  it("coordenação com a lista carregando não mostra Todas as minhas / Escolher", () => {
    lista.atual = { isLoading: true, error: undefined, vazia: false };
    sessao.atual = { user: { usuarioId: 8, unidade_id: 2 }, isCoordenacaoUnidade: true };
    abrir();

    expect(screen.getByText("Carregando unidades…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Todas as minhas")).not.toBeInTheDocument();
  });

  it("erro aparece no modal, que continua aberto", async () => {
    const resposta = {
      status: 400,
      data: { recorte: ["Use um destes: todos, nao_cadastrados, cadastrados."] },
      headers: {},
      config: { headers: new AxiosHeaders() },
      statusText: "Bad Request",
    } as AxiosResponse;
    vi.mocked(exportarSituacao).mockRejectedValue(
      new AxiosError("Bad Request", "400", undefined, undefined, resposta),
    );
    const aoFechar = abrir();

    await userEvent.click(screen.getByRole("button", { name: /^exportar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use um destes");
    expect(aoFechar).not.toHaveBeenCalled();
    expect(baixarArquivo).not.toHaveBeenCalled();
  });
});
