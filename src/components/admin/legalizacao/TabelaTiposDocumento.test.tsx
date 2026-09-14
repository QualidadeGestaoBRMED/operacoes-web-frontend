import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TipoDocumentoRegulatorio } from "@/types/legalizacao";
import { TabelaTiposDocumento } from "./TabelaTiposDocumento";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  atualizarTipoDocumento,
  listarTiposDocumento,
} from "@/lib/legalizacaoCatalogo";

const TIPO: TipoDocumentoRegulatorio = {
  id: 3,
  codigo: "licenca-sanitaria",
  nome: "Licença Sanitária",
  categoria: "regularizacao",
  area_responsavel: "legalizacao",
  setor_apoio: "",
  exige_validade: true,
  exige_protocolo: false,
  exige_evidencia: true,
  controlado_por_profissional: false,
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
};

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <TabelaTiposDocumento />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("TabelaTiposDocumento (STC-415)", () => {
  it("lista os tipos com nome, categoria e exigências", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    renderTela();

    expect(await screen.findByText("Licença Sanitária")).toBeInTheDocument();
    expect(
      screen.getByText("Regularização e licenciamento"),
    ).toBeInTheDocument();
    expect(screen.getByText("Validade")).toBeInTheDocument();
    expect(screen.getByText("Evidência")).toBeInTheDocument();
    expect(screen.queryByText("Protocolo")).not.toBeInTheDocument();
  });

  it("desativa um tipo de documento ao clicar em 'Desativar'", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    vi.mocked(atualizarTipoDocumento).mockResolvedValue({
      ...TIPO,
      ativo: false,
    });
    const user = userEvent.setup();
    renderTela();

    expect(await screen.findByText("Ativo")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /desativar licença sanitária/i }),
    );

    await waitFor(() => {
      expect(atualizarTipoDocumento).toHaveBeenCalledWith(TIPO.id, {
        ativo: false,
      });
    });
  });

  it("filtra por status ativo/inativo", async () => {
    const INATIVO: TipoDocumentoRegulatorio = {
      ...TIPO,
      id: 4,
      nome: "CNES",
      ativo: false,
    };
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO, INATIVO]);
    const user = userEvent.setup();
    renderTela();

    expect(await screen.findByText("Licença Sanitária")).toBeInTheDocument();
    expect(screen.getByText("CNES")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Status"));
    await user.click(await screen.findByRole("option", { name: "Ativos" }));

    expect(screen.getByText("Licença Sanitária")).toBeInTheDocument();
    expect(screen.queryByText("CNES")).not.toBeInTheDocument();
  });

  it("mostra uma mensagem de erro, não de lista vazia, quando o carregamento falha", async () => {
    vi.mocked(listarTiposDocumento).mockRejectedValue(new Error("Falha."));
    renderTela();

    expect(
      await screen.findByText(/não foi possível carregar os tipos/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum tipo de documento cadastrado ainda."),
    ).not.toBeInTheDocument();
  });
});
