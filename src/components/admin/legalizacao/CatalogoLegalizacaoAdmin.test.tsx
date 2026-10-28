import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogoLegalizacaoAdmin } from "./CatalogoLegalizacaoAdmin";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/plataforma");
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import { listarDocumentosLegalizacao } from "@/lib/legalizacao";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
import { listarUnidades } from "@/lib/plataforma";

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CatalogoLegalizacaoAdmin />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
    administraRedePadrao: true,
    redesAdministradas: ["padrao"],
    isCoordenacaoUnidade: false,
  } as never);
});

describe("CatalogoLegalizacaoAdmin (STC-415)", () => {
  it("renderiza os 3 blocos", async () => {
    renderTela();

    expect(await screen.findByText("Tipos de documento")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastrar documento na unidade"),
    ).toBeInTheDocument();
    expect(screen.getByText("Corrigir regra existente")).toBeInTheDocument();
  });

  it("abre o formulário de novo tipo de documento", async () => {
    const user = userEvent.setup();
    renderTela();

    await user.click(
      await screen.findByRole("button", { name: /novo tipo de documento/i }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Novo tipo de documento",
    );
  });

  it("abre o formulário de cadastrar documento", async () => {
    const user = userEvent.setup();
    renderTela();

    await user.click(
      await screen.findByRole("button", { name: /^cadastrar documento$/i }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Cadastrar documento",
    );
  });

  it("abre o formulário de cadastro em lote (STC-490)", async () => {
    const user = userEvent.setup();
    renderTela();

    await user.click(
      await screen.findByRole("button", { name: /cadastrar em lote/i }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Cadastrar documentos em lote",
    );
  });
});

describe("CatalogoLegalizacaoAdmin -- rede (STC-894)", () => {
  it("a tabela e os formulários usam as unidades e os tipos da rede escolhida", async () => {
    window.localStorage.setItem("atlas.legalizacao.rede", "opex");
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      isLoading: false,
      isAdminOps: true,
      administraRedePadrao: true,
      isCoordenacaoUnidade: false,
      redesAdministradas: ["opex", "padrao"],
    } as never);
    renderTela();

    expect(await screen.findByText("Tipos de documento")).toBeInTheDocument();
    expect(listarUnidades).toHaveBeenCalledWith("opex");
    expect(listarUnidades).not.toHaveBeenCalledWith("padrao");
    // STC-904: a tabela e os formulários usam o catálogo da rede.
    expect(listarTiposDocumento).toHaveBeenCalledWith("opex");
    expect(listarTiposDocumento).not.toHaveBeenCalledWith("padrao");
    window.localStorage.clear();
  });
});
