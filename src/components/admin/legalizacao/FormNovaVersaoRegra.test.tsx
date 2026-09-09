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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
};

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
    await user.clear(within(dialog).getByLabelText(/antecedência/i));
    await user.type(within(dialog).getByLabelText(/antecedência/i), "45");
    await user.click(within(dialog).getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Média" }));

    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      expect(criarRegraDocumento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_documento: TIPO.id,
          unidade: UNIDADE.id,
          antecedencia_dias: 45,
          criticidade: "media",
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
    await user.clear(within(dialog).getByLabelText(/antecedência/i));
    await user.type(within(dialog).getByLabelText(/antecedência/i), "45");
    await user.click(within(dialog).getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Média" }));
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
    await user.clear(within(dialog).getByLabelText(/antecedência/i));
    await user.type(within(dialog).getByLabelText(/antecedência/i), "45");
    await user.click(within(dialog).getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Média" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Criar nova versão" }),
    );

    await waitFor(() => {
      expect(excluirRegraDocumento).toHaveBeenCalledWith(99);
    });
  });
});
