import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentoUnidade, TipoDocumentoRegulatorio } from "@/types/legalizacao";
import type { Unidade } from "@/types";
import { FormCadastrarDocumentosEmLote } from "./FormCadastrarDocumentosEmLote";

vi.mock("@/lib/legalizacaoCatalogo");
vi.mock("@/lib/legalizacao");
vi.mock("@/lib/plataforma");
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuth } from "@/hooks/useAuth";
import {
  atualizarDocumentoLegalizacao,
  criarDocumentosLegalizacaoEmLote,
  enviarEvidenciaLegalizacao,
  listarDocumentosLegalizacao,
} from "@/lib/legalizacao";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
import { listarUnidades } from "@/lib/plataforma";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

const TIPO_EQUIPAMENTO: TipoDocumentoRegulatorio = {
  id: 7,
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
};

const TIPO_TERMOMETRO: TipoDocumentoRegulatorio = {
  id: 9,
  codigo: "calibracao-termometro",
  nome: "Calibração de Termômetro",
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
};

const TIPO_COMUM: TipoDocumentoRegulatorio = {
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

function documentoCriado(overrides: Partial<DocumentoUnidade> = {}): DocumentoUnidade {
  return {
    id: 1,
    tipo_documento: TIPO_EQUIPAMENTO,
    unidade: UNIDADE,
    status: "nao_iniciado",
    justificativa_excecao: "",
    validade: null,
    evidencia_vigente: null,
    regra_aplicada: {
      id: 55,
      tipo_documento: TIPO_EQUIPAMENTO.id,
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
    profissional: "Balança 01",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderForm(onOpenChange = vi.fn()) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormCadastrarDocumentosEmLote open onOpenChange={onOpenChange} />
    </SWRConfig>,
  );
}

async function preencherCamposComuns(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/^unidade/i));
  await user.click(await screen.findByRole("option", { name: "Niterói" }));
  await user.click(screen.getByLabelText(/tipo de documento/i));
  await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));
  await user.type(screen.getByLabelText(/vigente a partir/i), "2026-01-01");
  await user.type(screen.getByLabelText(/antecedência/i), "30");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO_EQUIPAMENTO, TIPO_COMUM]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
    isCoordenacaoUnidade: false,
  } as never);
});

describe("FormCadastrarDocumentosEmLote (STC-490)", () => {
  it("só lista tipos com permite_multiplas_instancias no select de tipo", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/tipo de documento/i));

    expect(
      await screen.findByRole("option", { name: "Calibração de Balança" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Licença Sanitária" }),
    ).not.toBeInTheDocument();
  });

  it("cria um documento por linha de identificador, com criticidade fixa em alta (STC-486), e abre o passo de evidências", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
      documentoCriado({ id: 1, profissional: "Balança 01" }),
      documentoCriado({ id: 2, profissional: "Balança 02" }),
      documentoCriado({ id: 3, profissional: "Balança 03" }),
    ]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\nBalança 02\nBalança 03",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    await waitFor(() => {
      expect(criarDocumentosLegalizacaoEmLote).toHaveBeenCalledWith({
        tipo_documento: TIPO_EQUIPAMENTO.id,
        unidade: UNIDADE.id,
        vigente_a_partir: "2026-01-01",
        antecedencia_dias: 30,
        janela_dia_inicio: null,
        janela_dia_fim: null,
        criticidade: "alta",
        gera_card_demanda: true,
        identificadores: ["Balança 01", "Balança 02", "Balança 03"],
      });
    });
    expect(toast.success).toHaveBeenCalledWith("3 documento(s) cadastrado(s).");
    // STC-490 (achado do usuário): evidência é por instância, não
    // compartilhada -- o diálogo não fecha sozinho, abre um passo 2.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(await screen.findByText("Anexar evidências (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Balança 01")).toBeInTheDocument();
    expect(screen.getByText("Balança 02")).toBeInTheDocument();
    expect(screen.getByText("Balança 03")).toBeInTheDocument();
  });

  it("não perde o foco pro <body> na transição do passo 1 pro passo 2 (achado em code review)", async () => {
    // O botão de submit (passo 1) some do DOM assim que o passo 2 renderiza
    // (dois retornos JSX distintos dentro do mesmo Dialog, sem <form>
    // compartilhado) -- achado em code review automático pra confirmar se o
    // FocusScope do Radix recupera o foco sozinho ou se ele cai pro <body>,
    // o que seria ruim pra quem navega por teclado/leitor de tela logo
    // depois do submit.
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    await screen.findByText("Anexar evidências (opcional)");

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute("role", "dialog");
  });

  it("bloqueia no client quando não há nenhum identificador", async () => {
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    expect(
      await screen.findByText(/informe ao menos um identificador/i),
    ).toBeInTheDocument();
    expect(criarDocumentosLegalizacaoEmLote).not.toHaveBeenCalled();
  });

  it("bloqueia no client identificador duplicado na mesma lista", async () => {
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\nBalança 01",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    expect(await screen.findByText(/duplicados/i)).toBeInTheDocument();
    expect(criarDocumentosLegalizacaoEmLote).not.toHaveBeenCalled();
  });

  it("mostra o erro devolvido pelo backend (ex. identificador já cadastrado)", async () => {
    // extrairMensagemErro só extrai a mensagem real de um erro com formato
    // de resposta do axios/DRF -- um Error comum cai no fallback genérico,
    // então o mock precisa ter esse formato pra testar o caminho de verdade.
    const erroApi = Object.assign(new Error("Bad Request"), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          identificadores: [
            "Já existe documento cadastrado com estes identificadores nesta unidade: Balança 01.",
          ],
        },
      },
    });
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockRejectedValue(erroApi);
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Já existe documento cadastrado com estes identificadores nesta unidade: Balança 01.",
      );
    });
  });

  it("ignora linhas em branco ao montar a lista de identificadores", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\n\n   \nBalança 02\n",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

    await waitFor(() => {
      expect(criarDocumentosLegalizacaoEmLote).toHaveBeenCalledWith(
        expect.objectContaining({ identificadores: ["Balança 01", "Balança 02"] }),
      );
    });
  });

  it("envia evidência de uma instância e isola a falha da outra (STC-490)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
      documentoCriado({ id: 1, profissional: "Balança 01" }),
      documentoCriado({ id: 2, profissional: "Balança 02" }),
    ]);
    vi.mocked(enviarEvidenciaLegalizacao).mockImplementation(async (id) => {
      if (id === 1) return {} as never;
      throw new Error("Falha de rede.");
    });
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\nBalança 02",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    // Dialog do Radix renderiza em portal (document.body), fora do
    // `container` que render() devolve -- document.querySelectorAll pega
    // o conteúdo portalizado, container não pegaria.
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    const certificado1 = new File(["x"], "cert1.pdf", { type: "application/pdf" });
    const certificado2 = new File(["x"], "cert2.pdf", { type: "application/pdf" });
    await user.upload(inputs[0] as HTMLInputElement, certificado1);
    await user.upload(inputs[1] as HTMLInputElement, certificado2);

    await waitFor(() => {
      expect(enviarEvidenciaLegalizacao).toHaveBeenCalledWith(1, certificado1);
      expect(enviarEvidenciaLegalizacao).toHaveBeenCalledWith(2, certificado2);
    });
    // Isolado por linha -- a falha de uma não impede ver que a outra deu certo.
    expect(await screen.findByText("Enviado")).toBeInTheDocument();
    expect(await screen.findByText("Falhou")).toBeInTheDocument();
  });

  it("botões 'Anexar'/'Salvar' de cada linha têm aria-label diferenciado por identificador (achado em code review)", async () => {
    // N linhas repetem os mesmos textos visuais ("Anexar", "Salvar") --
    // sem aria-label com o identificador, um leitor de tela que navegue
    // pela lista de controles da página (rotor/lista de botões) via
    // apenas "Anexar" x3, "Salvar" x3, indistinguíveis fora do contexto
    // visual da linha.
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
      documentoCriado({ id: 1, profissional: "Balança 01" }),
      documentoCriado({ id: 2, profissional: "Balança 02" }),
    ]);
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\nBalança 02",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    expect(
      screen.getByRole("button", { name: "Anexar evidência para Balança 01" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anexar evidência para Balança 02" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar status e validade de Balança 01" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar status e validade de Balança 02" }),
    ).toBeInTheDocument();
  });

  it("'Concluir' fecha o diálogo mesmo sem anexar nenhuma evidência", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(enviarEvidenciaLegalizacao).not.toHaveBeenCalled();
  });

  it("salva status e validade de um item (STC-490)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Regular" }));
    await user.type(screen.getByLabelText(/^validade/i), "2026-12-31");
    await user.click(screen.getByRole("button", { name: /^Salvar status e validade/ }));

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
        status: "regular",
        validade: "2026-12-31",
        // STC-497: sem isto, o backend rejeitava a transição direta
        // "Não iniciado" -> "Regular" (achado do usuário: status ficava
        // preso mesmo depois de "Salvar").
        definindo_status_inicial: true,
      });
    });
    expect(await screen.findByText("Salvo")).toBeInTheDocument();
  });

  it("bloqueia 'Vencido' sem validade no client, antes de chamar a API", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Vencido" }));
    await user.click(screen.getByRole("button", { name: /^Salvar status e validade/ }));

    expect(
      await screen.findByText("Validade obrigatória para status 'Vencido'."),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("reaproveita a regra já cadastrada nesta unidade+tipo e trava os campos (achado do usuário: 2º lote descartava valores digitados)", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documentoCriado({
        regra_aplicada: {
          ...documentoCriado().regra_aplicada!,
          vigente_a_partir: "2026-03-01",
          antecedencia_dias: 45,
          gera_card_demanda: false,
        },
      }),
    ]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/vigente a partir/i)).toHaveValue("2026-03-01");
    });
    expect(screen.getByLabelText(/vigente a partir/i)).toBeDisabled();
    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(45);
    expect(screen.getByLabelText(/antecedência/i)).toBeDisabled();
    expect(
      screen.getByText(/já tem uma regra cadastrada nesta unidade/i),
    ).toBeInTheDocument();
  });

  it("limpa os campos de regra ao trocar pra um tipo sem regra existente (não deixa o valor do tipo anterior vazar)", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO_EQUIPAMENTO, TIPO_TERMOMETRO]);
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documentoCriado({
        regra_aplicada: {
          ...documentoCriado().regra_aplicada!,
          vigente_a_partir: "2026-03-01",
          antecedencia_dias: 45,
        },
      }),
    ]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/vigente a partir/i)).toHaveValue("2026-03-01");
    });

    // Troca pra um tipo sem regra cadastrada nesta unidade -- os campos
    // precisam ficar editáveis E vazios, nunca com o valor do tipo anterior.
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Termômetro" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/vigente a partir/i)).not.toBeDisabled();
    });
    expect(screen.getByLabelText(/vigente a partir/i)).toHaveValue("");
    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(null);
  });

  it("trava o botão de cadastrar enquanto ainda verifica se existe regra pra esta unidade+tipo (evita corrida que descartaria os valores digitados)", async () => {
    let resolverBusca!: (documentos: DocumentoUnidade[]) => void;
    vi.mocked(listarDocumentosLegalizacao).mockReturnValue(
      new Promise((resolve) => {
        resolverBusca = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 09");

    expect(
      screen.getByRole("button", { name: /verificando regra/i }),
    ).toBeDisabled();
    expect(criarDocumentosLegalizacaoEmLote).not.toHaveBeenCalled();

    resolverBusca([]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^cadastrar documentos$/i }),
      ).not.toBeDisabled();
    });
  });

  it("Esc não fecha o passo de evidências -- só X ou 'Concluir' (achado no dogfooding)", async () => {
    // Documentos já foram criados de verdade no passo 1 -- fechar sem
    // querer (Esc/clique fora) não pode passar a impressão de que também
    // desfez a criação, diferente do passo 1 (onde cancelar de fato não
    // cria nada).
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências (opcional)");

    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Anexar evidências (opcional)")).toBeInTheDocument();
  });
});

describe("FormCadastrarDocumentosEmLote -- Coordenador só cadastra na própria unidade (STC-514)", () => {
  const OUTRA_UNIDADE: Unidade = {
    id: 2,
    nome: "Vitória",
    codigo: "VIT",
    cidade: "Vitória",
    ativa: true,
    rede: "padrao",
  };

  it("unidade já vem pré-selecionada, sem oferecer outras da rede (senão 403 no submit)", async () => {
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

    renderForm();

    expect(
      await screen.findByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent(UNIDADE.nome);

    await user.click(screen.getByLabelText(/^unidade/i));
    expect(
      screen.queryByRole("option", { name: OUTRA_UNIDADE.nome }),
    ).not.toBeInTheDocument();
  });
});
