import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentoUnidade, TipoDocumentoRegulatorio } from "@/types/legalizacao";
import type { Unidade, Usuario } from "@/types";
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
  listarCandidatosResponsaveis,
  listarDocumentosLegalizacao,
} from "@/lib/legalizacao";
import { listarTiposDocumento } from "@/lib/legalizacaoCatalogo";
import { listarUnidades } from "@/lib/plataforma";
import { hojeISO } from "@/lib/utils";

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

const USUARIO_CANDIDATO: Usuario = {
  id: 5,
  username: "ana.souza",
  email: "ana.souza@grupobrmed.com.br",
  first_name: "Ana",
  last_name: "Souza",
  perfil: null,
  unidade_id: UNIDADE.id,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
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

// STC-517: mesmo padrão de FormCadastrarDocumento.test.tsx --
// getByRole("checkbox", {name}) funciona porque o texto do <label> vira o
// nome acessível do Checkbox (mesmo padrão já usado em PermissoesAdmin.test.tsx).
async function selecionarResponsavel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /responsável\(is\)/i }),
  );
  await user.click(
    await screen.findByRole("checkbox", { name: "Ana Souza" }),
  );
}

async function preencherCamposComuns(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/^unidade/i));
  await user.click(await screen.findByRole("option", { name: "Niterói" }));
  await user.click(screen.getByLabelText(/tipo de documento/i));
  await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));
  await user.clear(screen.getByLabelText(/início dos alertas/i));
  await user.type(screen.getByLabelText(/início dos alertas/i), "2026-01-01");
  await selecionarResponsavel(user);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
  vi.mocked(listarTiposDocumento).mockResolvedValue([TIPO_EQUIPAMENTO, TIPO_COMUM]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(listarCandidatosResponsaveis).mockResolvedValue([USUARIO_CANDIDATO]);
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
  it("Antecedência vem travada em 60, e 'Data de início dos alertas' pré-preenchida com hoje (STC-523)", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(60);
    expect(screen.getByLabelText(/antecedência/i)).toBeDisabled();
    expect(screen.getByLabelText(/início dos alertas/i)).toHaveValue(hojeISO());
    expect(screen.getByLabelText(/início dos alertas/i)).not.toBeDisabled();
  });

  it("pré-preenche 'Antecedência' com o valor configurado pro tipo, não mais fixo em 60 (STC-537)", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue([
      { ...TIPO_EQUIPAMENTO, antecedencia_padrao_dias: 30 },
      TIPO_COMUM,
    ]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(30);
    expect(screen.getByLabelText(/antecedência/i)).toBeDisabled();
  });

  it("mantém a antecedência do tipo já escolhido ao trocar só de unidade -- este form não limpa o tipo (achado em code review, STC-537)", async () => {
    const OUTRA_UNIDADE: Unidade = {
      id: 2,
      nome: "Vitória",
      codigo: "VIT",
      cidade: "Vitória",
      ativa: true,
      rede: "padrao",
    };
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, OUTRA_UNIDADE]);
    vi.mocked(listarTiposDocumento).mockResolvedValue([
      { ...TIPO_EQUIPAMENTO, antecedencia_padrao_dias: 30 },
    ]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));
    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(30);

    // Diferente de FormCadastrarDocumento.tsx, trocar de unidade aqui NÃO
    // limpa o tipo já escolhido (o Select de tipo continua mostrando
    // "Calibração de Balança") -- a antecedência precisa continuar
    // refletindo esse tipo, não cair no fallback de 60.
    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Vitória" }));

    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(30);
  });

  it("recalcula 'Data de início dos alertas' ao abrir, não só na montagem (achado em code review, STC-523)", () => {
    // CatalogoLegalizacaoAdmin.tsx nunca desmonta este formulário (fica
    // `hidden` entre trocas de aba) -- sem recalcular no open, uma aba
    // deixada aberta de um dia pro outro, sem nunca ter aberto este diálogo
    // antes, mostraria a data de ontem na primeira abertura.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00"));
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <FormCadastrarDocumentosEmLote open={false} onOpenChange={onOpenChange} />
      </SWRConfig>,
    );

    // Passa pro dia seguinte sem o diálogo nunca ter sido aberto.
    vi.setSystemTime(new Date("2026-09-04T09:00:00"));
    rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <FormCadastrarDocumentosEmLote open onOpenChange={onOpenChange} />
      </SWRConfig>,
    );

    expect(screen.getByLabelText(/início dos alertas/i)).toHaveValue(
      "2026-09-04",
    );

    vi.useRealTimers();
  });

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
        antecedencia_dias: 60,
        janela_dia_inicio: null,
        janela_dia_fim: null,
        criticidade: "alta",
        gera_card_demanda: true,
        identificadores: ["BALANÇA 01", "BALANÇA 02", "BALANÇA 03"],
        responsaveis: [USUARIO_CANDIDATO.id],
      });
    });
    expect(toast.success).toHaveBeenCalledWith("3 documento(s) cadastrado(s).");
    // STC-490 (achado do usuário): evidência é por instância, não
    // compartilhada -- o diálogo não fecha sozinho, abre um passo 2.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(await screen.findByText("Anexar evidências")).toBeInTheDocument();
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

    await screen.findByText("Anexar evidências");

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
        expect.objectContaining({ identificadores: ["BALANÇA 01", "BALANÇA 02"] }),
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
    await screen.findByText("Anexar evidências");

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

  it("botão 'Anexar' de cada linha tem aria-label diferenciado por identificador (achado em code review)", async () => {
    // N linhas repetem o mesmo texto visual ("Anexar") -- sem aria-label
    // com o identificador, um leitor de tela que navegue pela lista de
    // controles da página (rotor/lista de botões) via só "Anexar" x2,
    // indistinguíveis fora do contexto visual da linha.
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
    await screen.findByText("Anexar evidências");

    expect(
      screen.getByRole("button", { name: "Anexar evidência para Balança 01" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anexar evidência para Balança 02" }),
    ).toBeInTheDocument();
  });

  it("'Concluir' salva o status escolhido e fecha o diálogo mesmo sem anexar evidência, quando o status não exige (STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    // STC-531: sem status escolhido ainda, "Concluir" vem desabilitado --
    // não dá mais pra sair do passo 2 sem confirmar status de todo item.
    expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled();

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
        status: "nao_iniciado",
        validade: null,
        definindo_status_inicial: true,
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(enviarEvidenciaLegalizacao).not.toHaveBeenCalled();
  });

  it("'Concluir' salva o status/validade de todo item numa tacada só (STC-490/STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Regular" }));
    await user.type(screen.getByLabelText(/^validade/i), "2026-12-31");
    // STC-524: "Regular" exige evidência anexada antes de concluir.
    const inputArquivo = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const certificado = new File(["x"], "cert.pdf", { type: "application/pdf" });
    await user.upload(inputArquivo, certificado);
    await screen.findByText("Enviado");
    await user.click(screen.getByRole("button", { name: "Concluir" }));

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
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("Anexo obrigatório pra status Regular/Protocolado (STC-524)", () => {
    it("bloqueia 'Concluir' quando um item está 'Regular' sem evidência anexada", async () => {
      vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
        documentoCriado(),
      ]);
      const user = userEvent.setup();
      renderForm();

      await preencherCamposComuns(user);
      await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
      await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
      await screen.findByText("Anexar evidências");

      const botaoConcluir = screen.getByRole("button", { name: "Concluir" });
      // STC-531: sem status escolhido ainda, já vem desabilitado.
      expect(botaoConcluir).toBeDisabled();

      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(await screen.findByRole("option", { name: "Regular" }));

      expect(botaoConcluir).toBeDisabled();
      expect(
        screen.getByText('Anexo obrigatório pra status "Regular".'),
      ).toBeInTheDocument();

      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const certificado = new File(["x"], "cert.pdf", { type: "application/pdf" });
      await user.upload(inputArquivo, certificado);

      await waitFor(() => {
        expect(botaoConcluir).not.toBeDisabled();
      });
      expect(
        screen.queryByText('Anexo obrigatório pra status "Regular".'),
      ).not.toBeInTheDocument();
    });

    it("bloqueia 'Concluir' pra 'Protocolado' sem evidência, mas não pros demais status", async () => {
      vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
        documentoCriado(),
      ]);
      const user = userEvent.setup();
      renderForm();

      await preencherCamposComuns(user);
      await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
      await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
      await screen.findByText("Anexar evidências");

      const botaoConcluir = screen.getByRole("button", { name: "Concluir" });

      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(await screen.findByRole("option", { name: "Protocolado" }));
      expect(botaoConcluir).toBeDisabled();

      // Trocar pra um status que não exige documento em mãos libera de novo,
      // mesmo sem anexo -- comportamento já existente, preservado.
      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(await screen.findByRole("option", { name: "Em andamento" }));
      expect(botaoConcluir).not.toBeDisabled();
    });

    it("'Concluir' desabilitado impede persistir 'Regular' sem evidência -- achado em análise própria original: bloquear só o fechar não impedia persistir o status sem anexo (STC-531 endurece isso pro Concluir em si)", async () => {
      const onOpenChange = vi.fn();
      vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
        documentoCriado(),
      ]);
      vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
      const user = userEvent.setup();
      renderForm(onOpenChange);

      await preencherCamposComuns(user);
      await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
      await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
      await screen.findByText("Anexar evidências");

      await user.click(screen.getByLabelText(/status inicial/i));
      await user.click(await screen.findByRole("option", { name: "Regular" }));

      // "Concluir" já vem desabilitado (evidência obrigatória pra Regular)
      // -- nada é persistido, e o diálogo não fecha.
      expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled();
      expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();

      // Anexando a evidência, "Concluir" libera e passa a salvar/fechar.
      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const certificado = new File(["x"], "cert.pdf", { type: "application/pdf" });
      await user.upload(inputArquivo, certificado);
      await screen.findByText("Enviado");
      await user.click(screen.getByRole("button", { name: "Concluir" }));

      await waitFor(() => {
        expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
          status: "regular",
          validade: null,
          definindo_status_inicial: true,
        });
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("'Concluir' bloqueia 'Vencido' sem validade, sem chamar a API nem fechar o diálogo", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Vencido" }));
    // "Vencido" não exige evidência (STC-524), só validade -- "Concluir"
    // fica habilitado (a checagem preemptiva não sabe da validade), mas a
    // validação real dentro de concluir() ainda barra.
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(
      await screen.findByText("Validade obrigatória para status 'Vencido'."),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
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
      expect(screen.getByLabelText(/início dos alertas/i)).toHaveValue("2026-03-01");
    });
    expect(screen.getByLabelText(/início dos alertas/i)).toBeDisabled();
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
      expect(screen.getByLabelText(/início dos alertas/i)).toHaveValue("2026-03-01");
    });

    // Troca pra um tipo sem regra cadastrada nesta unidade -- "Data de
    // início dos alertas" precisa ficar editável de novo (voltando pro
    // default de hoje), nunca com o valor do tipo anterior. STC-523:
    // "Antecedência" continua sempre desabilitada (fixa em 60), reaproveitando
    // regra ou não -- só o valor precisa deixar de ser o do tipo anterior.
    await user.click(screen.getByLabelText(/tipo de documento/i));
    await user.click(await screen.findByRole("option", { name: "Calibração de Termômetro" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/início dos alertas/i)).not.toBeDisabled();
    });
    expect(screen.getByLabelText(/início dos alertas/i)).toHaveValue(hojeISO());
    expect(screen.getByLabelText(/antecedência/i)).toHaveValue(60);
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

  it("Esc no passo de evidências roda a mesma validação de 'Concluir' -- não fecha com item incompleto (STC-531)", async () => {
    // Documentos já foram criados de verdade no passo 1. STC-531 (achado
    // do usuário): as 4 formas de fechar (X, Esc, clique fora, "Concluir")
    // passam pela MESMA validação/salvamento agora -- Esc não é mais
    // bloqueado incondicionalmente (onEscapeKeyDown/onInteractOutside
    // foram removidos), ele só não FECHA de fato enquanto sobrar item sem
    // status confirmado, igual "Concluir" desabilitado faria.
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    // Nenhum status escolhido ainda -- Esc tenta concluir, falha a
    // validação, não fecha.
    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Anexar evidências")).toBeInTheDocument();
  });

  it("Esc no passo de evidências fecha de verdade quando todo item já está completo (STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
      status: "nao_iniciado",
      validade: null,
      definindo_status_inicial: true,
    });
  });

  it("botão 'Close' (X) roda a mesma validação de 'Concluir' -- não fecha com item incompleto (achado em code review, STC-531)", async () => {
    // Mesmo padrão dos testes de Esc acima -- achado em code review
    // automático: só Esc e "Concluir" tinham teste, faltava o X (mesmo
    // botão de sempre do Dialog, DialogPrimitive.Close) e o clique fora.
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Anexar evidências")).toBeInTheDocument();
  });

  it("botão 'Close' (X) fecha de verdade quando todo item já está completo (achado em code review, STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
      status: "nao_iniciado",
      validade: null,
      definindo_status_inicial: true,
    });
  });

  it("clique fora (overlay) roda a mesma validação de 'Concluir' -- não fecha com item incompleto (achado em code review, STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    // Overlay do Radix -- irmão do conteúdo do diálogo dentro do mesmo
    // portal, é justamente o alvo que o Radix trata como "fora" do conteúdo.
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    await user.click(overlay as Element);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Anexar evidências")).toBeInTheDocument();
  });

  it("clique fora (overlay) fecha de verdade quando todo item já está completo (achado em code review, STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documentoCriado());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    await user.click(overlay as Element);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(1, {
      status: "nao_iniciado",
      validade: null,
      definindo_status_inicial: true,
    });
  });

  it("fechar sem nenhum status escolhido em vários itens não acumula espera de pacing de throttle (achado em code review, STC-531)", async () => {
    // O intervalo mínimo entre chamadas (pacing pro throttle do backend, ver
    // concluir()) só faz sentido em cima de uma chamada de rede de verdade
    // -- itens que reprovam validação local (aqui, nenhum tem status
    // escolhido) nunca chegam no PATCH. Sem o fix, o pacing rodava mesmo
    // assim, acumulando ~1.1s por item só pra reprovar validação local; o
    // timeout padrão do waitFor abaixo (1000ms) já é curto o bastante pra
    // pegar essa regressão com 3 itens (~2.2s perdidos sem o fix).
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
    await screen.findByText("Anexar evidências");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getAllByText("Selecione o status.")).toHaveLength(3);
    });
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("'Concluir' mantém o diálogo aberto e mostra o erro quando falha ao salvar um item (achado em code review, STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([documentoCriado()]);
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(new Error("Falha de rede."));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    await user.click(screen.getByLabelText(/status inicial/i));
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Existem itens que não puderam ser salvos -- veja os erros de cada um antes de concluir.",
      );
    });
    // Falha real ao salvar não pode fechar com dado incompleto, mesmo com
    // "Concluir" tendo sido de fato clicado.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByText("Não foi possível completar a operação. Tente novamente."),
    ).toBeInTheDocument();
  });

  it("retomar 'Concluir' após falha parcial não reenvia um item que já foi salvo com sucesso e não mudou (achado em code review, STC-531)", async () => {
    vi.mocked(criarDocumentosLegalizacaoEmLote).mockResolvedValue([
      documentoCriado({ id: 1, profissional: "Balança 01" }),
      documentoCriado({ id: 2, profissional: "Balança 02" }),
    ]);
    let tentativasItem2 = 0;
    vi.mocked(atualizarDocumentoLegalizacao).mockImplementation(async (id) => {
      if (id === 2) {
        tentativasItem2 += 1;
        if (tentativasItem2 === 1) throw new Error("Falha de rede.");
      }
      return documentoCriado({ id });
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onOpenChange);

    await preencherCamposComuns(user);
    await user.type(
      screen.getByLabelText(/identificadores/i),
      "Balança 01\nBalança 02",
    );
    await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));
    await screen.findByText("Anexar evidências");

    const gatilhosDeStatus = screen.getAllByLabelText(/status inicial/i);
    await user.click(gatilhosDeStatus[0]);
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));
    await user.click(gatilhosDeStatus[1]);
    await user.click(await screen.findByRole("option", { name: "Não iniciado" }));

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    // Intervalo mínimo entre chamadas (pacing de throttle, ver concluir())
    // insere ~1.1s de espera real entre o item 1 (sucesso) e o item 2
    // (falha) -- timeout maior que o default do waitFor.
    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      vi.mocked(atualizarDocumentoLegalizacao).mock.calls.filter(([id]) => id === 1),
    ).toHaveLength(1);
    expect(
      vi.mocked(atualizarDocumentoLegalizacao).mock.calls.filter(([id]) => id === 2),
    ).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    // O item 1 (já salvo com sucesso, sem mudança desde então) não é
    // reenviado na nova tentativa -- só o item 2, que tinha falhado.
    expect(
      vi.mocked(atualizarDocumentoLegalizacao).mock.calls.filter(([id]) => id === 1),
    ).toHaveLength(1);
    expect(
      vi.mocked(atualizarDocumentoLegalizacao).mock.calls.filter(([id]) => id === 2),
    ).toHaveLength(2);
  }, 10000);

  describe("Responsável operacional obrigatório (STC-517)", () => {
    it("não deixa submeter sem nenhum responsável selecionado", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));
      await user.clear(screen.getByLabelText(/início dos alertas/i));
      await user.type(screen.getByLabelText(/início dos alertas/i), "2026-01-01");
      await user.type(screen.getByLabelText(/identificadores/i), "Balança 01");

      await user.click(screen.getByRole("button", { name: /cadastrar documentos/i }));

      expect(
        await screen.findByText("Selecione pelo menos 1 responsável."),
      ).toBeInTheDocument();
      expect(criarDocumentosLegalizacaoEmLote).not.toHaveBeenCalled();
    });

    it("candidatos do seletor refletem a unidade e o tipo de documento escolhidos", async () => {
      const responsavelDoSetorApoio: Usuario = {
        ...USUARIO_CANDIDATO,
        id: 8,
        first_name: "Bruno",
        last_name: "Lima",
        unidade_id: null,
        setor_id: 4,
      };
      vi.mocked(listarCandidatosResponsaveis).mockImplementation(
        async (unidade, tipoDocumento) =>
          unidade === UNIDADE.id && tipoDocumento === TIPO_EQUIPAMENTO.id
            ? [USUARIO_CANDIDATO, responsavelDoSetorApoio]
            : [],
      );
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

      await waitFor(() => {
        expect(listarCandidatosResponsaveis).toHaveBeenCalledWith(
          UNIDADE.id,
          TIPO_EQUIPAMENTO.id,
        );
      });
      await user.click(
        screen.getByRole("button", { name: /responsável\(is\)/i }),
      );
      expect(
        await screen.findByRole("checkbox", { name: "Ana Souza" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Bruno Lima" }),
      ).toBeInTheDocument();
    });

    it("mostra erro (não 'nenhum candidato') e permite tentar de novo quando a busca falha", async () => {
      // STC-517 (achado em code review): mesmo achado do form unitário --
      // sem isso, falha de rede/permissão aparecia como "nenhum candidato",
      // indistinguível de a unidade realmente não ter ninguém elegível.
      vi.mocked(listarCandidatosResponsaveis)
        .mockRejectedValueOnce(new Error("Falha de rede."))
        .mockResolvedValueOnce([USUARIO_CANDIDATO]);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));
      await user.click(
        screen.getByRole("button", { name: /responsável\(is\)/i }),
      );

      expect(
        await screen.findByText(
          "Não foi possível completar a operação. Tente novamente.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/nenhum candidato encontrado/i),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /tentar novamente/i }));

      expect(
        await screen.findByRole("checkbox", { name: "Ana Souza" }),
      ).toBeInTheDocument();
    });

    it("o rótulo 'Responsável(is)' está associado ao controle (getByLabelText encontra o gatilho)", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/^unidade/i));
      await user.click(await screen.findByRole("option", { name: "Niterói" }));
      await user.click(screen.getByLabelText(/tipo de documento/i));
      await user.click(await screen.findByRole("option", { name: "Calibração de Balança" }));

      expect(screen.getByLabelText(/^responsável\(is\)/i)).toBeInTheDocument();
    });

    it("explica por texto visível (não só title) por que o gatilho está desabilitado antes de escolher unidade/tipo", async () => {
      renderForm();

      const gatilho = screen.getByRole("button", { name: /responsável\(is\)/i });
      expect(gatilho).toHaveTextContent(
        "Escolha a unidade e o tipo de documento primeiro",
      );
      expect(gatilho).toBeDisabled();
    });
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
