import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DocumentoUnidade,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import type { Unidade } from "@/types";
import { FormCadastrarDocumento } from "./FormCadastrarDocumento";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  enviarEvidenciaLegalizacao,
  criarDocumentoLegalizacao,
} from "@/lib/legalizacao";
import { criarRegraDocumento } from "@/lib/legalizacaoCatalogo";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
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

function documentoCriado(
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
    regra_aplicada: null,
    responsaveis: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderForm(onOpenChange = vi.fn()) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormCadastrarDocumento open onOpenChange={onOpenChange} />
    </SWRConfig>,
  );
}

async function selecionarUnidadeETipo(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByLabelText(/^unidade/i));
  await user.click(await screen.findByRole("option", { name: "Niterói" }));
  await user.click(screen.getByLabelText(/tipo de documento/i));
  await user.click(
    await screen.findByRole("option", { name: "Licença Sanitária" }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO]);
});

describe("FormCadastrarDocumento (STC-415)", () => {
  it("caminho 'Não aplicável': exige justificativa e não cria regra nenhuma", async () => {
    vi.mocked(criarDocumentoLegalizacao).mockResolvedValue(
      documentoCriado({
        status: "nao_aplicavel",
        justificativa_excecao: "Unidade não tem raio-x.",
      }),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await selecionarUnidadeETipo(user);
    await user.click(
      screen.getByRole("checkbox", { name: /não aplicável a esta unidade/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    expect(
      await screen.findByText("Obrigatória para marcar Não aplicável."),
    ).toBeInTheDocument();
    expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText(/justificativa/i),
      "Unidade não tem raio-x.",
    );
    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(criarDocumentoLegalizacao).toHaveBeenCalledWith({
        tipo_documento: TIPO.id,
        unidade: UNIDADE.id,
        status: "nao_aplicavel",
        justificativa_excecao: "Unidade não tem raio-x.",
      });
    });
    expect(criarRegraDocumento).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("status 'Vencido' sem validade é bloqueado no client, antes de qualquer chamada", async () => {
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Vencido" }));
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "30");
    await user.click(screen.getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Alta" }));

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    expect(
      await screen.findByText("Obrigatória para status 'Vencido'."),
    ).toBeInTheDocument();
    expect(criarRegraDocumento).not.toHaveBeenCalled();
    expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("caminho normal: cria a regra, depois o documento com regra_aplicada apontando pra ela", async () => {
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 55,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 60,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "alta",
      vigente_a_partir: "2026-01-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(criarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(
      await screen.findByRole("option", { name: "Em andamento" }),
    );
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "60");
    await user.click(screen.getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Alta" }));

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(criarRegraDocumento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_documento: TIPO.id,
          unidade: UNIDADE.id,
          antecedencia_dias: 60,
          criticidade: "alta",
          vigente_a_partir: "2026-01-01",
          gera_card_demanda: true,
        }),
      );
    });
    await waitFor(() => {
      expect(criarDocumentoLegalizacao).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_documento: TIPO.id,
          unidade: UNIDADE.id,
          status: "em_andamento",
          regra_aplicada: 55,
        }),
      );
    });
    expect(enviarEvidenciaLegalizacao).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("com evidência anexada, envia o arquivo pro documento recém-criado", async () => {
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 55,
      tipo_documento: TIPO.id,
      unidade: UNIDADE.id,
      antecedencia_dias: 60,
      periodicidade_meses: null,
      janela_dia_inicio: null,
      janela_dia_fim: null,
      criticidade: "alta",
      vigente_a_partir: "2026-01-01",
      ativa: true,
      gera_card_demanda: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(criarDocumentoLegalizacao).mockResolvedValue(
      documentoCriado({ id: 99 }),
    );
    vi.mocked(enviarEvidenciaLegalizacao).mockResolvedValue({
      id: 1,
      usuario: {
        id: 1,
        username: "fernanda",
        email: "fernanda@grupobrmed.com.br",
        first_name: "Fernanda",
        last_name: "Lima",
        perfil: null,
        unidade_id: null,
        setor_id: null,
        ativo: true,
        ultimo_acesso: null,
        foto_url: "",
      },
      arquivo: "https://example.com/arquivo.pdf",
      nome_original: "alvara.pdf",
      tamanho_bytes: 1024,
      vigente: true,
      emitido_em: null,
      validade_comprovada: null,
      processo_renovacao: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(
      await screen.findByRole("option", { name: "Em andamento" }),
    );
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "60");
    await user.click(screen.getByLabelText(/criticidade/i));
    await user.click(await screen.findByRole("option", { name: "Alta" }));

    const arquivo = new File(["conteudo"], "alvara.pdf", {
      type: "application/pdf",
    });
    const inputArquivo = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(inputArquivo, arquivo);

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(enviarEvidenciaLegalizacao).toHaveBeenCalledWith(99, arquivo);
    });
  });
});
