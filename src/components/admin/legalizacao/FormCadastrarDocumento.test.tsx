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
  listarDocumentosLegalizacao,
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
  controlado_por_profissional: false,
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
};

const TIPO_DOSIMETRIA: TipoDocumentoRegulatorio = {
  id: 9,
  codigo: "dosimetria",
  nome: "Dosimetria",
  categoria: "registros_tecnicos",
  area_responsavel: "legalizacao",
  setor_apoio: "",
  exige_validade: true,
  exige_protocolo: false,
  exige_evidencia: false,
  controlado_por_profissional: true,
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
    profissional: "",
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
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
});

describe("FormCadastrarDocumento (STC-415)", () => {
  it("não lista um tipo que a unidade escolhida já tem cadastrado", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documentoCriado(),
    ]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({
        unidade: UNIDADE.id,
      });
    });
    await user.click(screen.getByLabelText(/tipo de documento/i));

    expect(
      screen.queryByRole("option", { name: "Licença Sanitária" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        "Todos os tipos de documento ativos já foram cadastrados para esta unidade.",
      ),
    ).toBeInTheDocument();
  });

  it("trocar de unidade limpa o Tipo de documento selecionado antes (STC-488)", async () => {
    const OUTRA_UNIDADE: Unidade = {
      id: 2,
      nome: "Vitória",
      codigo: "VIT",
      cidade: "Vitória",
      ativa: true,
    };
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, OUTRA_UNIDADE]);
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Vitória" }));

    // Mesmo bug de exibição do STC-488 (Select do Radix preso no último
    // valor ao limpar pra undefined) -- aqui pro próprio Tipo de documento,
    // não só pros campos do documento.
    expect(screen.getByLabelText(/tipo de documento/i)).toHaveTextContent(
      "Selecionar...",
    );
  });

  it("rede de segurança: bloqueia no submit se o cadastro mudou entre abrir o formulário e enviar", async () => {
    // 1ª chamada (filtro do select, ao escolher a unidade): nada cadastrado
    // ainda, "Licença Sanitária" aparece normal. 2ª chamada (cheque explícito
    // dentro de aoSubmeter): já existe -- simula alguém cadastrar o mesmo
    // tipo+unidade nesse meio-tempo.
    vi.mocked(listarDocumentosLegalizacao)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([documentoCriado()]);
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(
      await screen.findByRole("option", { name: "Em andamento" }),
    );
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "60");

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({
        unidade: UNIDADE.id,
        tipo_documento: TIPO.id,
      });
    });
    expect(criarRegraDocumento).not.toHaveBeenCalled();
    expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

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

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    expect(
      await screen.findByText("Obrigatória para status 'Vencido'."),
    ).toBeInTheDocument();
    expect(criarRegraDocumento).not.toHaveBeenCalled();
    expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("status 'Vencido' com validade preenchida cadastra normalmente", async () => {
    vi.mocked(criarRegraDocumento).mockResolvedValue({
      id: 55,
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
    });
    vi.mocked(criarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Vencido" }));
    await user.type(screen.getByLabelText(/validade/i), "2026-01-01");
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "30");

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(criarDocumentoLegalizacao).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "vencido",
          validade: "2026-01-01",
        }),
      );
    });
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

  it("input de evidência aceita só PDF (STC-433)", async () => {
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);

    const inputArquivo = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    expect(inputArquivo).toHaveAttribute("accept", ".pdf");
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

  it("botão de remover evidência anexada tem nome acessível e some o arquivo", async () => {
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    const arquivo = new File(["conteudo"], "alvara.pdf", {
      type: "application/pdf",
    });
    const inputArquivo = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(inputArquivo, arquivo);

    expect(screen.getByText("alvara.pdf")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remover alvara.pdf" }),
    );

    expect(screen.queryByText("alvara.pdf")).not.toBeInTheDocument();
  });

  it("desfaz a regra recém-criada se criar o documento falhar em seguida", async () => {
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
    vi.mocked(criarDocumentoLegalizacao).mockRejectedValue(
      new Error("Já existe um documento para este tipo e unidade."),
    );
    const user = userEvent.setup();
    renderForm();

    await selecionarUnidadeETipo(user);
    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(
      await screen.findByRole("option", { name: "Em andamento" }),
    );
    await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
    await user.type(screen.getByLabelText(/antecedência/i), "60");

    await user.click(
      screen.getByRole("button", { name: /cadastrar documento/i }),
    );

    await waitFor(() => {
      expect(excluirRegraDocumento).toHaveBeenCalledWith(55);
    });
  });

  it("upload de evidência falha: documento fica cadastrado e um novo clique só reenvia o arquivo", async () => {
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
    vi.mocked(enviarEvidenciaLegalizacao).mockRejectedValueOnce(
      new Error("Falha de rede."),
    );
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

    // Documento e regra já foram criados de verdade -- o diálogo não fecha
    // (evidência ainda não chegou), e o botão vira "Reenviar evidência".
    expect(
      await screen.findByRole("button", { name: /reenviar evidência/i }),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(criarRegraDocumento).toHaveBeenCalledTimes(1);
    expect(criarDocumentoLegalizacao).toHaveBeenCalledTimes(1);

    vi.mocked(enviarEvidenciaLegalizacao).mockResolvedValueOnce({
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

    await user.click(
      screen.getByRole("button", { name: /reenviar evidência/i }),
    );

    await waitFor(() => {
      expect(enviarEvidenciaLegalizacao).toHaveBeenCalledTimes(2);
    });
    expect(enviarEvidenciaLegalizacao).toHaveBeenLastCalledWith(99, arquivo);
    // Não tentou recriar regra/documento no reenvio.
    expect(criarRegraDocumento).toHaveBeenCalledTimes(1);
    expect(criarDocumentoLegalizacao).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("upload falha e o arquivo é removido: 'Concluir' fecha sem tentar reenviar nada", async () => {
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
    vi.mocked(enviarEvidenciaLegalizacao).mockRejectedValueOnce(
      new Error("Falha de rede."),
    );
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
    await screen.findByRole("button", { name: /reenviar evidência/i });

    // Evidência é opcional -- remove o arquivo em vez de tentar de novo.
    await user.click(
      screen.getByRole("button", { name: "Remover alvara.pdf" }),
    );
    const botaoConcluir = await screen.findByRole("button", {
      name: "Concluir",
    });
    await user.click(botaoConcluir);

    // Sem arquivo, não há o que reenviar -- não chama enviarEvidenciaLegalizacao
    // de novo (só a 1ª tentativa, que falhou) nem tenta recriar regra/documento.
    expect(enviarEvidenciaLegalizacao).toHaveBeenCalledTimes(1);
    expect(criarRegraDocumento).toHaveBeenCalledTimes(1);
    expect(criarDocumentoLegalizacao).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("Dosimetria -- tipo controlado por profissional (STC-432)", () => {
    async function preencherCamposObrigatorios(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(
        await screen.findByRole("option", { name: "Em andamento" }),
      );
      await user.type(
        screen.getByLabelText(/vigente a partir/i),
        "2026-01-01",
      );
      await user.type(screen.getByLabelText(/antecedência/i), "60");
    }

    it("campo Profissional só aparece pra tipo controlado por profissional", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(
        await screen.findByRole("option", { name: "Licença Sanitária" }),
      );
      expect(screen.queryByLabelText(/profissional/i)).not.toBeInTheDocument();

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      expect(screen.getByLabelText(/profissional/i)).toBeInTheDocument();
    });

    it("tipo controlado por profissional continua disponível mesmo já cadastrado nesta unidade", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
        }),
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));

      expect(
        await screen.findByRole("option", { name: "Dosimetria" }),
      ).toBeInTheDocument();
    });

    it("bloqueia no client, sem chamar a API, se Profissional ficar vazio", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await preencherCamposObrigatorios(user);

      await user.click(
        screen.getByRole("button", { name: /cadastrar documento/i }),
      );

      expect(
        await screen.findByText("Obrigatório para este tipo de documento."),
      ).toBeInTheDocument();
      expect(criarRegraDocumento).not.toHaveBeenCalled();
      expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
    });

    it("cadastra um segundo profissional na mesma unidade reaproveitando a regra já existente", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const regraExistente = {
        id: 55,
        tipo_documento: TIPO_DOSIMETRIA.id,
        unidade: UNIDADE.id,
        antecedencia_dias: 60,
        periodicidade_meses: null,
        janela_dia_inicio: null,
        janela_dia_fim: null,
        criticidade: "alta" as const,
        vigente_a_partir: "2026-01-01",
        ativa: true,
        gera_card_demanda: true,
        created_at: "2026-01-01T00:00:00Z",
      };
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
          regra_aplicada: regraExistente,
        }),
      ]);
      vi.mocked(criarDocumentoLegalizacao).mockResolvedValue(
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dra. Maria",
          regra_aplicada: regraExistente,
        }),
      );
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderForm(onOpenChange);

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await user.type(screen.getByLabelText(/profissional/i), "Dra. Maria");
      // STC-432: vigente_a_partir/antecedência já vêm preenchidos (e
      // desabilitados) pela regra reaproveitada -- só falta escolher o
      // status inicial, que é por documento, não por regra.
      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(
        await screen.findByRole("option", { name: "Em andamento" }),
      );

      expect(screen.getByLabelText(/vigente a partir/i)).toBeDisabled();
      expect(screen.getByLabelText(/antecedência/i)).toBeDisabled();

      await user.click(
        screen.getByRole("button", { name: /cadastrar documento/i }),
      );

      await waitFor(() => {
        expect(criarDocumentoLegalizacao).toHaveBeenCalledWith(
          expect.objectContaining({
            tipo_documento: TIPO_DOSIMETRIA.id,
            profissional: "Dra. Maria",
            regra_aplicada: 55,
          }),
        );
      });
      expect(criarRegraDocumento).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("bloqueia cadastro duplicado do mesmo profissional na mesma unidade", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
        }),
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await user.type(screen.getByLabelText(/profissional/i), "Dr. João");
      await preencherCamposObrigatorios(user);

      await user.click(
        screen.getByRole("button", { name: /cadastrar documento/i }),
      );

      await waitFor(() => {
        expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({
          unidade: UNIDADE.id,
          tipo_documento: TIPO_DOSIMETRIA.id,
        });
      });
      expect(criarRegraDocumento).not.toHaveBeenCalled();
      expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
    });

    it("trocar de tipo limpa o Profissional digitado antes (achado em análise própria)", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await user.type(screen.getByLabelText(/profissional/i), "Dr. João");

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(
        await screen.findByRole("option", { name: "Licença Sanitária" }),
      );
      expect(screen.queryByLabelText(/profissional/i)).not.toBeInTheDocument();

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));

      // Se não tivesse limpado, o profissional de antes (de um tipo já
      // trocado) reapareceria aqui sem o usuário ter digitado nada.
      expect(screen.getByLabelText(/profissional/i)).toHaveValue("");
    });

    it("trocar de tipo depois de reaproveitar uma regra limpa os campos de regra preenchidos (achado no code review automático)", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const regraExistente = {
        id: 55,
        tipo_documento: TIPO_DOSIMETRIA.id,
        unidade: UNIDADE.id,
        antecedencia_dias: 60,
        periodicidade_meses: null,
        janela_dia_inicio: null,
        janela_dia_fim: null,
        criticidade: "alta" as const,
        vigente_a_partir: "2026-01-01",
        ativa: true,
        gera_card_demanda: true,
        created_at: "2026-01-01T00:00:00Z",
      };
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
          regra_aplicada: regraExistente,
        }),
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));

      // Regra reaproveitada: campos vêm preenchidos e travados.
      expect(screen.getByLabelText(/vigente a partir/i)).toHaveValue(
        "2026-01-01",
      );
      expect(screen.getByLabelText(/antecedência/i)).toHaveValue(60);
      expect(screen.getByLabelText(/vigente a partir/i)).toBeDisabled();

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(
        await screen.findByRole("option", { name: "Licença Sanitária" }),
      );

      // Achado no code review automático: sem limpar, estes campos ficavam
      // editáveis de novo mas com os valores da regra de Dosimetria, prontos
      // pra ir no submit como se fossem da regra nova de Licença Sanitária.
      expect(screen.getByLabelText(/vigente a partir/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/vigente a partir/i)).toHaveValue("");
      expect(screen.getByLabelText(/antecedência/i)).toHaveValue(null);
    });

    it("trocar de tipo limpa status/validade preenchidos antes (STC-488, achado em avaliação de uso)", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const user = userEvent.setup();
      renderForm();

      await selecionarUnidadeETipo(user);
      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(await screen.findByRole("option", { name: "Vencido" }));
      await user.type(screen.getByLabelText(/validade/i), "2026-01-01");

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));

      // Achado em avaliação de uso: status/validade sobreviviam
      // silenciosamente à troca de tipo, prontos pra ir no submit como se
      // fossem do documento novo (ex.: Bombeiros com status "Vencido" ->
      // trocar pra Ambiental mantinha "Vencido" e a validade preenchidos).
      expect(screen.getByLabelText(/status inicial/i)).toHaveTextContent(
        "Selecionar...",
      );
      expect(screen.getByLabelText(/validade/i)).toHaveValue("");
    });

    it("trocar de tipo desmarca 'Não aplicável' e limpa a justificativa preenchida antes (STC-488)", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      const user = userEvent.setup();
      renderForm();

      await selecionarUnidadeETipo(user);
      await user.click(
        screen.getByRole("checkbox", { name: /não aplicável/i }),
      );
      await user.type(
        screen.getByLabelText(/justificativa/i),
        "Não presta este serviço.",
      );

      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));

      expect(
        screen.getByRole("checkbox", { name: /não aplicável/i }),
      ).not.toBeChecked();
      expect(screen.queryByLabelText(/justificativa/i)).not.toBeInTheDocument();
    });

    it("trim: não deixa cadastrar duplicata do mesmo profissional só por espaço em branco a mais", async () => {
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
        }),
      ]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await user.type(screen.getByLabelText(/profissional/i), "  Dr. João  ");
      await preencherCamposObrigatorios(user);

      await user.click(
        screen.getByRole("button", { name: /cadastrar documento/i }),
      );

      await waitFor(() => {
        expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({
          unidade: UNIDADE.id,
          tipo_documento: TIPO_DOSIMETRIA.id,
        });
      });
      expect(criarDocumentoLegalizacao).not.toHaveBeenCalled();
    });

    it("trim: o caminho normal (com regra) envia o profissional sem espaços, não o valor bruto do input", async () => {
      // Achado no code review automático do PR: o trim só tinha sido
      // aplicado no caminho "Não aplicável" (o de exceção) -- o caminho
      // comum, que cria/reaproveita uma regra, ainda mandava o valor bruto
      // do input pro backend.
      vi.mocked(listarTiposDocumento).mockResolvedValue([
        TIPO,
        TIPO_DOSIMETRIA,
      ]);
      vi.mocked(criarRegraDocumento).mockResolvedValue({
        id: 55,
        tipo_documento: TIPO_DOSIMETRIA.id,
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
        documentoCriado({
          tipo_documento: TIPO_DOSIMETRIA,
          profissional: "Dr. João",
        }),
      );
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Dosimetria" }));
      await user.type(screen.getByLabelText(/profissional/i), "  Dr. João  ");
      await preencherCamposObrigatorios(user);

      await user.click(
        screen.getByRole("button", { name: /cadastrar documento/i }),
      );

      await waitFor(() => {
        expect(criarDocumentoLegalizacao).toHaveBeenCalledWith(
          expect.objectContaining({ profissional: "Dr. João" }),
        );
      });
    });
  });
});
