import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TipoDocumentoRegulatorio } from "@/types/legalizacao";
import type { Setor } from "@/types";
import { FormNovoTipoDocumento } from "./FormNovoTipoDocumento";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  atualizarTipoDocumento,
  criarTipoDocumento,
} from "@/lib/legalizacaoCatalogo";
import { listarSetores } from "@/lib/plataforma";

const SETOR_TI: Setor = {
  id: 11,
  nome: "TI",
  codigo: "TI",
  modulo_id: null,
  ativo: true,
};

function renderForm(
  onOpenChange = vi.fn(),
  tipoDocumento?: TipoDocumentoRegulatorio | null,
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormNovoTipoDocumento
        open
        onOpenChange={onOpenChange}
        tipoDocumento={tipoDocumento}
      />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarSetores).mockResolvedValue([SETOR_TI]);
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
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
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
        permite_multiplas_instancias: false,
        setor_apoio_id: null,
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
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
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

  it("permite ligar 'Permite múltiplas instâncias' (STC-489/STC-490)", async () => {
    vi.mocked(criarTipoDocumento).mockResolvedValue({
      id: 3,
      codigo: "calibracao-balanca",
      nome: "Calibração de Balança",
      categoria: "equipamentos",
      area_responsavel: "legalizacao",
      setor_apoio: "",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      controlado_por_profissional: false,
      permite_multiplas_instancias: true,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/nome/i), "Calibração de Balança");
    await user.type(screen.getByLabelText(/código/i), "calibracao-balanca");
    await user.click(screen.getByLabelText(/categoria/i));
    await user.click(await screen.findByRole("option", { name: "Equipamentos" }));
    await user.click(screen.getByLabelText(/área responsável/i));
    await user.click(await screen.findByRole("option", { name: "Legalização" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Permite múltiplas instâncias" }),
    );

    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    await waitFor(() => {
      expect(criarTipoDocumento).toHaveBeenCalledWith(
        expect.objectContaining({
          permite_multiplas_instancias: true,
        }),
      );
      // Achado em code review: "Controlado por profissional" (Dosimetria)
      // não tem checkbox nesta tela de propósito -- liga também a
      // Movimentação Profissional, uma decisão maior que não fazia parte
      // do escopo da STC-490 (só permite_multiplas_instancias).
      expect(vi.mocked(criarTipoDocumento).mock.calls[0][0]).not.toHaveProperty(
        "controlado_por_profissional",
      );
    });
  });

  it("ajuda do setor de apoio cita a unidade e a área responsável (STC-759)", () => {
    renderForm(vi.fn());
    expect(
      screen.getByText(
        "Além da unidade e da área responsável, pessoas deste setor também poderão ser escolhidas como Responsável Operacional nos documentos deste tipo.",
      ),
    ).toBeInTheDocument();
  });

  it("envia o setor de apoio escolhido (STC-526)", async () => {
    vi.mocked(criarTipoDocumento).mockResolvedValue({
      id: 4,
      codigo: "pcmso",
      nome: "PCMSO",
      categoria: "programas",
      area_responsavel: "legalizacao",
      setor_apoio: "TI",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/^nome/i), "PCMSO");
    await user.type(screen.getByLabelText(/^código/i), "pcmso");
    await user.click(screen.getByLabelText(/categoria/i));
    await user.click(
      await screen.findByRole("option", { name: "Programas obrigatórios" }),
    );
    await user.click(screen.getByLabelText(/área responsável/i));
    await user.click(
      await screen.findByRole("option", { name: "Legalização" }),
    );
    await user.click(screen.getByLabelText(/setor de apoio/i));
    await user.click(await screen.findByRole("option", { name: "TI" }));

    await user.click(
      screen.getByRole("button", { name: /cadastrar tipo de documento/i }),
    );

    await waitFor(() => {
      expect(criarTipoDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ setor_apoio_id: SETOR_TI.id }),
      );
    });
  });

  it("pré-preenche o setor de apoio ao editar um tipo que já tem um configurado (STC-526)", async () => {
    const tipo: TipoDocumentoRegulatorio = {
      id: 5,
      codigo: "pcmso",
      nome: "PCMSO",
      categoria: "programas",
      area_responsavel: "legalizacao",
      setor_apoio: "TI",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(atualizarTipoDocumento).mockResolvedValue(tipo);
    renderForm(vi.fn(), tipo);

    // getAllByText: o próprio Radix Select espelha o valor também num
    // <select> nativo escondido (mesmo achado documentado em
    // PermissoesAdmin.test.tsx) -- 2 elementos com o mesmo texto.
    await waitFor(() => {
      expect(screen.getAllByText("TI").length).toBeGreaterThan(0);
    });
  });

  it("não apaga edições em andamento quando o fetch de setores resolve depois do diálogo já aberto (achado em code review, STC-526)", async () => {
    // FormNovoTipoDocumento fica sempre montado em TabelaTiposDocumento.tsx
    // -- o fetch de useSetores() começa assim que a tela carrega, não
    // quando o diálogo abre. Simula "Editar" clicado antes desse fetch
    // resolver: o efeito roda 2x pro mesmo tipoDocumento (setores=[]
    // primeiro, depois a lista real).
    let resolverSetores: (setores: Setor[]) => void = () => {};
    vi.mocked(listarSetores).mockReturnValue(
      new Promise((resolve) => {
        resolverSetores = resolve;
      }),
    );
    const tipo: TipoDocumentoRegulatorio = {
      id: 6,
      codigo: "pcmso",
      nome: "PCMSO",
      categoria: "programas",
      area_responsavel: "legalizacao",
      setor_apoio: "TI",
      exige_validade: true,
      exige_protocolo: false,
      exige_evidencia: true,
      controlado_por_profissional: false,
      permite_multiplas_instancias: false,
      ativo: true,
      created_at: "2026-01-01T00:00:00Z",
    };
    const user = userEvent.setup();
    renderForm(vi.fn(), tipo);

    await user.clear(screen.getByLabelText(/^nome/i));
    await user.type(screen.getByLabelText(/^nome/i), "PCMSO Alterado");

    resolverSetores([SETOR_TI]);

    // Confirma que o segundo reset (disparado por setores.length mudar de
    // 0 pra 1) realmente aconteceu -- Setor de apoio só aparece depois dele.
    await waitFor(() => {
      expect(screen.getAllByText("TI").length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText(/^nome/i)).toHaveValue("PCMSO Alterado");
  });
});
