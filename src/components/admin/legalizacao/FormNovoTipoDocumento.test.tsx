import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormNovoTipoDocumento } from "./FormNovoTipoDocumento";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { criarTipoDocumento } from "@/lib/legalizacaoCatalogo";

function renderForm(onOpenChange = vi.fn()) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormNovoTipoDocumento open onOpenChange={onOpenChange} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FormNovoTipoDocumento (STC-415)", () => {
  it("exige nome, código, categoria e área responsável", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    expect(await screen.findByText("Nome é obrigatório.")).toBeInTheDocument();
    expect(screen.getByText("Código é obrigatório.")).toBeInTheDocument();
    expect(screen.getByText("Selecione a categoria.")).toBeInTheDocument();
    expect(
      screen.getByText("Selecione a área responsável."),
    ).toBeInTheDocument();
    expect(criarTipoDocumento).not.toHaveBeenCalled();
  });

  it("rejeita código fora do formato slug", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/código/i), "Licença Sanitária");
    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    expect(
      await screen.findByText(
        "Use só letras minúsculas, números e hífen (ex.: licenca-sanitaria).",
      ),
    ).toBeInTheDocument();
    expect(criarTipoDocumento).not.toHaveBeenCalled();
  });

  it("cadastra com os defaults de exigência corretos (validade/evidência ligados, protocolo desligado)", async () => {
    vi.mocked(criarTipoDocumento).mockResolvedValue({
      id: 1,
      codigo: "licenca-sanitaria",
      nome: "Licença Sanitária",
      categoria: "regularizacao",
      area_responsavel: "legalizacao",
      setor_apoio: "",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await user.type(screen.getByLabelText(/^nome/i), "Licença Sanitária");
    await user.type(screen.getByLabelText(/^código/i), "licenca-sanitaria");

    await user.click(screen.getByLabelText(/categoria/i));
    await user.click(
      await screen.findByRole("option", {
        name: "Regularização e licenciamento",
      }),
    );

    await user.click(screen.getByLabelText(/área responsável/i));
    await user.click(
      await screen.findByRole("option", { name: "Legalização" }),
    );

    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    await waitFor(() => {
      expect(criarTipoDocumento).toHaveBeenCalledWith({
        nome: "Licença Sanitária",
        codigo: "licenca-sanitaria",
        categoria: "regularizacao",
        area_responsavel: "legalizacao",
        exige_validade: true,
        exige_protocolo: false,
        exige_evidencia: true,
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite ligar 'Exige protocolo' e desligar 'Exige validade'/'Exige evidência'", async () => {
    vi.mocked(criarTipoDocumento).mockResolvedValue({
      id: 2,
      codigo: "cnes",
      nome: "CNES",
      categoria: "registros_tecnicos",
      area_responsavel: "coordenacao",
      setor_apoio: "",
      exige_validade: false,
      exige_protocolo: true,
      exige_evidencia: false,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/^nome/i), "CNES");
    await user.type(screen.getByLabelText(/^código/i), "cnes");
    await user.click(screen.getByLabelText(/categoria/i));
    await user.click(
      await screen.findByRole("option", { name: "Registros técnicos" }),
    );
    await user.click(screen.getByLabelText(/área responsável/i));
    await user.click(
      await screen.findByRole("option", { name: "Coordenação da Unidade" }),
    );

    await user.click(screen.getByRole("checkbox", { name: "Exige validade" }));
    await user.click(screen.getByRole("checkbox", { name: "Exige protocolo" }));
    await user.click(screen.getByRole("checkbox", { name: "Exige evidência" }));

    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    await waitFor(() => {
      expect(criarTipoDocumento).toHaveBeenCalledWith(
        expect.objectContaining({
          exige_validade: false,
          exige_protocolo: true,
          exige_evidencia: false,
        }),
      );
    });
  });
});
