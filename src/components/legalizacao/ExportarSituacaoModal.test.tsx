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
vi.mock("@/hooks/useUnidades", () => ({
  useUnidades: () => ({ unidades: UNIDADES, isLoading: false, error: undefined }),
}));

vi.mock("@/lib/legalizacaoExportacao", async (original) => ({
  ...(await original<typeof import("@/lib/legalizacaoExportacao")>()),
  exportarSituacao: vi.fn(),
  baixarArquivo: vi.fn(),
}));
import { baixarArquivo, exportarSituacao } from "@/lib/legalizacaoExportacao";

const ADMIN = { user: { usuarioId: 7 }, isCoordenacaoUnidade: false };
const ARQUIVO = { arquivo: new Blob(["x"]), nome: "situacao-legalizacao_todos_2026-11-03.xlsx" };

function abrir(aoFechar = vi.fn()) {
  render(<ExportarSituacaoModal aberto aoFechar={aoFechar} />);
  return aoFechar;
}

beforeEach(() => {
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
