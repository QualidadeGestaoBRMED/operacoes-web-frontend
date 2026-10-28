import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import type {
  DocumentoUnidade,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { FormNovaVersaoRegra } from "./FormNovaVersaoRegra";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/plataforma");
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import {
  listarDocumentosLegalizacao,
  atualizarDocumentoLegalizacao,
} from "@/lib/legalizacao";
import {
  criarRegraDocumento,
  excluirRegraDocumento,
  listarTiposDocumento,
} from "@/lib/legalizacaoCatalogo";
import { listarUnidades } from "@/lib/plataforma";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

const TIPO: TipoDocumentoRegulatorio = {
  id: 3,
  codigo: "licenca-sanitaria",
  nome: "Licença Sanitária",
  categoria: "regularizacao",
  area_responsavel: "legalizacao",
  abrangencia: "padrao",
  setor_apoio: "",
  exige_validade: true,
  exige_protocolo: false,
  exige_evidencia: true,
  controlado_por_profissional: false,
  permite_multiplas_instancias: false,
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
};

function documento(
  overrides: Partial<DocumentoUnidade> = {},
): DocumentoUnidade {
  return {
    id: 87,
    tipo_documento: TIPO,
    unidade: UNIDADE,
    status: "em_andamento",
    justificativa_excecao: "",
    validade: null,
    evidencia_vigente: null,
    regra_aplicada: {
      id: 12,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 30,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "alta",
      vigente_a_partir: "2026-01-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    responsaveis: [],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderComponente() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormNovaVersaoRegra />
    </SWRConfig>,
  );
}

async function selecionarUnidadeETipo(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByLabelText("Unidade"));
  await user.click(await screen.findByRole("option", { name: "Niterói" }));
  await user.click(screen.getByLabelText("Tipo de documento"));
  await user.click(
    await screen.findByRole("option", { name: "Licença Sanitária" }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
    isCoordenacaoUnidade: false,
  } as never);
});

describe("FormNovaVersaoRegra (STC-415)", () => {
  it("mostra a regra atual e permite abrir 'Criar nova versão'", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);

    expect(
      await screen.findByText(/vigente desde 01\/01\/2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/30 dias de antecedência/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /criar nova versão/i }),
    );

    expect(await screen.findByText("Nova versão da regra")).toBeInTheDocument();
  });

  it("avisa quando não existe documento cadastrado para a combinação", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);

    expect(
      await screen.findByText(
        /nenhum documento cadastrado para esta combinação/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra erro de carregamento, não 'nenhum documento', quando a busca falha", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);

    expect(
      await screen.findByText(/não foi possível carregar o documento/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nenhum documento cadastrado para esta combinação/i),
    ).not.toBeInTheDocument();
  });

  it("bloqueia vigente_a_partir igual ou anterior à vigência atual", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);
    await user.click(
      await screen.findByRole("button", { name: /criar nova versão/i }),
    );

    // O botão que abre o dialog e o de submeter têm o mesmo nome -- escopa
    // ao dialog pra não ambiguar.
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/vigente a partir/i),
      "2026-01-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    expect(
      await screen.findByText(
        /precisa ser depois de 01\/01\/2026 \(vigência atual\)/i,
      ),
    ).toBeInTheDocument();
    expect(criarRegraDocumento).not.toHaveBeenCalled();
  });

  it("cria uma nova versão e reaplica no documento", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 99,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 45,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "media",
      vigente_a_partir: "2026-06-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-06-01T00:00:00Z",
    });
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);
    await user.click(
      await screen.findByRole("button", { name: /criar nova versão/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/vigente a partir/i),
      "2026-06-01",
    );
    // STC-523: antecedência travada em 60, não editável -- nada pra digitar.

    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      // STC-486: não é mais escolhido no formulário -- sempre "alta".
      expect(criarRegraDocumento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_documento: TIPO.id,
          unidade: UNIDADE.id,
          antecedencia_dias: 60,
          criticidade: "alta",
          vigente_a_partir: "2026-06-01",
          periodicidade_meses: null,
        }),
      );
    });
    await waitFor(() => {
      // atualizarDocumentoLegalizacao é a função crua de lib/legalizacao.ts
      // (id, payload) -- o hook useAtualizarDocumentoLegalizacao é quem
      // aceita {id, payload} como argumento único.
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(
        documento().id,
        {
          regra_aplicada: 99,
        },
      );
    });
  });

  it("pré-preenche 'Antecedência' com o valor configurado pro tipo, não mais fixo em 60 (STC-537)", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({
        tipo_documento: { ...TIPO, antecedencia_padrao_dias: 30 },
      }),
    ]);
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 99,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 30,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "media",
      vigente_a_partir: "2026-06-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-06-01T00:00:00Z",
    });
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);
    await user.click(
      await screen.findByRole("button", { name: /criar nova versão/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/antecedência/i)).toHaveValue(30);

    await user.type(
      within(dialog).getByLabelText(/vigente a partir/i),
      "2026-06-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      expect(criarRegraDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ antecedencia_dias: 30 }),
      );
    });
  });

  it("carrega periodicidade_meses da regra anterior pra nova versão, sem campo próprio no form", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({
        regra_aplicada: {
          ...documento().regra_aplicada!,
          periodicidade_meses: 12,
        },
      }),
    ]);
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 99,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 45,
      periodicidade_meses: 12,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "media",
      vigente_a_partir: "2026-06-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-06-01T00:00:00Z",
    });
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);
    await user.click(
      await screen.findByRole("button", { name: /criar nova versão/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/vigente a partir/i),
      "2026-06-01",
    );
    // STC-523: antecedência travada em 60, não editável -- nada pra digitar.
    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      expect(criarRegraDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ periodicidade_meses: 12 }),
      );
    });
  });

  it("desfaz a regra recém-criada se aplicá-la ao documento falhar", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 99,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 45,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "media",
      vigente_a_partir: "2026-06-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-06-01T00:00:00Z",
    });
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      new Error("Falha ao aplicar a regra."),
    );
    const user = userEvent.setup();
    renderComponente();

    await selecionarUnidadeETipo(user);
    await user.click(
      await screen.findByRole("button", { name: /criar nova versão/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/vigente a partir/i),
      "2026-06-01",
    );
    // STC-523: antecedência travada em 60, não editável -- nada pra digitar.
    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      expect(excluirRegraDocumento).toHaveBeenCalledWith(99);
    });
  });

  it("bloqueia 'Corrigir regra' quando a combinação tem mais de um documento (tipo controlado por profissional, STC-432)", async () => {
    const TIPO_DOSIMETRIA: TipoDocumentoRegulatorio = {
      ...TIPO,
      id: 9,
      codigo: "dosimetria",
      nome: "Dosimetria",
      controlado_por_profissional: true,
      permite_multiplas_instancias: false,
    };
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO_DOSIMETRIA]);
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({
        id: 1,
        tipo_documento: TIPO_DOSIMETRIA,
        profissional: "Dr. João",
      }),
      documento({
        id: 2,
        tipo_documento: TIPO_DOSIMETRIA,
        profissional: "Dra. Maria",
      }),
    ]);
    const user = userEvent.setup();
    renderComponente();

    await user.click(screen.getByLabelText("Unidade"));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText("Tipo de documento"));
    await user.click(await screen.findByRole("option", { name: "Dosimetria" }));

    expect(
      await screen.findByText(/2 documentos cadastrados nesta unidade/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Criar nova versão" }),
    ).not.toBeInTheDocument();
  });
});

describe("FormNovaVersaoRegra -- Coordenador só corrige regra da própria unidade (STC-514)", () => {
  const OUTRA_UNIDADE: Unidade = {
    id: 2,
    nome: "Vitória",
    codigo: "VIT",
    cidade: "Vitória",
    ativa: true,
    rede: "padrao",
  };

  it("unidade já vem pré-selecionada, sem oferecer outras da rede", async () => {
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, OUTRA_UNIDADE]);
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: UNIDADE.id },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    const user = userEvent.setup();

    renderComponente();

    expect(
      await screen.findByRole("combobox", { name: "Unidade" }),
    ).toHaveTextContent(UNIDADE.nome);

    await user.click(screen.getByLabelText("Unidade"));
    expect(
      screen.queryByRole("option", { name: OUTRA_UNIDADE.nome }),
    ).not.toBeInTheDocument();
  });
});
