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
  listarHistoricoTipoDocumento,
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
  permite_multiplas_instancias: false,
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

describe("TabelaTiposDocumento -- editar tipo de documento (STC-501)", () => {
  it("'Editar' abre o formulário pré-preenchido, com Código travado", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Licença Sanitária");

    await user.click(
      screen.getByRole("button", { name: "Editar Licença Sanitária" }),
    );

    expect(await screen.findByText("Editar tipo de documento")).toBeInTheDocument();
    expect(screen.getByLabelText(/^nome/i)).toHaveValue("Licença Sanitária");
    expect(screen.getByLabelText(/^código/i)).toHaveValue("licenca-sanitaria");
    expect(screen.getByLabelText(/^código/i)).toBeDisabled();
  });

  it("salva a edição via PATCH e mostra sucesso", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    vi.mocked(atualizarTipoDocumento).mockResolvedValue({
      ...TIPO,
      nome: "Licença Sanitária Municipal",
    });
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Licença Sanitária");

    await user.click(
      screen.getByRole("button", { name: "Editar Licença Sanitária" }),
    );
    await screen.findByText("Editar tipo de documento");
    const campoNome = screen.getByLabelText(/^nome/i);
    await user.clear(campoNome);
    await user.type(campoNome, "Licença Sanitária Municipal");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(atualizarTipoDocumento).toHaveBeenCalledWith(
        TIPO.id,
        expect.objectContaining({ nome: "Licença Sanitária Municipal" }),
      );
    });
    expect(
      screen.queryByText("Editar tipo de documento"),
    ).not.toBeInTheDocument();
  });

  it("edita outro campo normalmente mesmo quando o código já salvo foge do regex do form (achado em code review)", async () => {
    // Tipos cadastrados direto no banco/Django Admin (a própria razão desta
    // issue existir) podem ter código com underscore/maiúscula, fora do
    // regex de slug do form -- sem schema condicional, o campo travado
    // (disabled) ainda era validado no submit e travava a edição de
    // QUALQUER campo, inclusive o Nome (o pedido real do cliente).
    const tipoComCodigoLegado = { ...TIPO, codigo: "licenca_sanitaria" };
    vi.mocked(listarTiposDocumento).mockResolvedValue([tipoComCodigoLegado]);
    vi.mocked(atualizarTipoDocumento).mockResolvedValue({
      ...tipoComCodigoLegado,
      nome: "Licença Sanitária Municipal",
    });
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Licença Sanitária");

    await user.click(
      screen.getByRole("button", { name: "Editar Licença Sanitária" }),
    );
    await screen.findByText("Editar tipo de documento");
    const campoNome = screen.getByLabelText(/^nome/i);
    await user.clear(campoNome);
    await user.type(campoNome, "Licença Sanitária Municipal");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(atualizarTipoDocumento).toHaveBeenCalledWith(
        tipoComCodigoLegado.id,
        expect.objectContaining({ nome: "Licença Sanitária Municipal" }),
      );
    });
    expect(
      screen.queryByText(/letras minúsculas, números e hífen/i),
    ).not.toBeInTheDocument();
  });
});

describe("TabelaTiposDocumento -- histórico de edição (STC-501)", () => {
  it("'Histórico' abre o modal e lista as edições traduzidas", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    vi.mocked(listarHistoricoTipoDocumento).mockResolvedValue([
      {
        id: 1,
        usuario: {
          id: 9,
          username: "admin",
          email: "admin@grupobrmed.com.br",
          first_name: "Admin",
          last_name: "Q&G",
          perfil: null,
          unidade_id: null,
          setor_id: null,
          ativo: true,
          ultimo_acesso: null,
          foto_url: "",
        },
        campo: "nome",
        valor_anterior: "licença sanitária",
        valor_novo: "Licença Sanitária",
        created_at: "2026-09-21T12:00:00Z",
      },
    ]);
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Licença Sanitária");

    await user.click(
      screen.getByRole("button", { name: "Ver histórico de Licença Sanitária" }),
    );

    expect(
      await screen.findByText("Histórico de edições -- Licença Sanitária"),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin Q&G")).toBeInTheDocument();
    expect(screen.getByText("nome")).toBeInTheDocument();
    expect(screen.getByText('"licença sanitária"')).toBeInTheDocument();
    expect(screen.getByText('"Licença Sanitária"')).toBeInTheDocument();
  });

  it("mostra 'nenhuma edição registrada' quando o histórico está vazio", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
    vi.mocked(listarHistoricoTipoDocumento).mockResolvedValue([]);
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Licença Sanitária");

    await user.click(
      screen.getByRole("button", { name: "Ver histórico de Licença Sanitária" }),
    );

    expect(
      await screen.findByText("Nenhuma edição registrada ainda."),
    ).toBeInTheDocument();
  });
});
