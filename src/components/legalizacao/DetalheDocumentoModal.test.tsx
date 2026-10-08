import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
  DocumentoUnidade,
  EvidenciaRegulatoria,
  HistoricoRegulatorio,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { DetalheDocumentoModal } from "./DetalheDocumentoModal";

vi.mock("@/lib/legalizacao");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { usuarioId: 7 },
    perfil: null,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: false,
  }),
}));

import {
  adicionarResponsavelLegalizacao,
  atualizarDocumentoLegalizacao,
  buscarDocumentoLegalizacao,
  criarProcessoRenovacao,
  listarCandidatosResponsaveis,
  listarDocumentosLegalizacao,
  listarEvidenciasLegalizacao,
  listarHistoricoLegalizacao,
  listarProcessosRenovacao,
  removerResponsavelLegalizacao,
  reverterDocumentoLegalizacao,
  urlAbsolutaDaEvidencia,
} from "@/lib/legalizacao";
import { toast } from "sonner";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

const USUARIO: Usuario = {
  id: 10,
  username: "leg",
  email: "leg@grupobrmed.com.br",
  first_name: "Time",
  last_name: "Legalização",
  perfil: null,
  unidade_id: null,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
};

const OUTRO_USUARIO: Usuario = {
  id: 11,
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

const TERCEIRO_USUARIO: Usuario = {
  id: 12,
  username: "bruno.lima",
  email: "bruno.lima@grupobrmed.com.br",
  first_name: "Bruno",
  last_name: "Lima",
  perfil: null,
  unidade_id: UNIDADE.id,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
};

function tipo(
  overrides: Partial<TipoDocumentoRegulatorio> = {},
): TipoDocumentoRegulatorio {
  return {
    id: 3,
    codigo: "alvara-funcionamento",
    nome: "Alvará de Funcionamento",
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
    ...overrides,
  };
}

function documento(
  overrides: Partial<DocumentoUnidade> = {},
): DocumentoUnidade {
  return {
    id: 55,
    tipo_documento: tipo(),
    unidade: UNIDADE,
    status: "regular",
    justificativa_excecao: "",
    validade: "2026-12-01",
    evidencia_vigente: null,
    regra_aplicada: {
      id: 9,
      tipo_documento: 3,
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
    },
    responsaveis: [
      {
        id: 1,
        usuario: USUARIO,
        principal: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function evidencia(
  overrides: Partial<EvidenciaRegulatoria> = {},
): EvidenciaRegulatoria {
  return {
    id: 1,
    usuario: USUARIO,
    arquivo: "https://example.com/arquivo.pdf",
    nome_original: "alvara.pdf",
    tamanho_bytes: 2048,
    vigente: true,
    emitido_em: null,
    validade_comprovada: null,
    processo_renovacao: null,
    created_at: "2026-07-15T00:00:00Z",
    ...overrides,
  };
}

function historico(
  overrides: Partial<HistoricoRegulatorio> = {},
): HistoricoRegulatorio {
  return {
    id: 1,
    usuario: USUARIO,
    acao: "status",
    valor_anterior: "em_andamento",
    valor_novo: "vencido",
    created_at: "2026-08-15T03:00:00Z",
    ...overrides,
  };
}

// Relativo a "hoje" de propósito -- mesmo motivo de hoje + timedelta(...)
// nos testes do backend: o texto de prazo (prazoDocumento, legalizacaoMatriz.ts)
// depende da data real de execução do teste, não pode ser um valor absoluto.
function diasAtras(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

function renderComponente(
  documentoId: number | null,
  onOpenChange: (open: boolean) => void = vi.fn(),
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DetalheDocumentoModal
        documentoId={documentoId}
        onOpenChange={onOpenChange}
      />
    </SWRConfig>,
  );
}

// Harness pra provar que criar o processo invalida a MESMA chave de lista
// que a Matriz por trás do modal usa -- sem isso, a tabela ficava com o
// status antigo até o próximo poll (achado numa análise de falhas críticas,
// STC-380). ChamaListarDocumentos só existe pra fazer o hook de lista
// existir na mesma árvore/cache do SWRConfig do teste.
function ListaPorTras() {
  useDocumentosLegalizacao();
  return null;
}

function renderComComListaPorTras(documentoId: number | null) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ListaPorTras />
      <DetalheDocumentoModal documentoId={documentoId} onOpenChange={vi.fn()} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(urlAbsolutaDaEvidencia).mockImplementation((url) => url);
  vi.mocked(listarEvidenciasLegalizacao).mockResolvedValue([]);
  vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([]);
  vi.mocked(listarProcessosRenovacao).mockResolvedValue([]);
});

describe("DetalheDocumentoModal (STC-380)", () => {
  it("não renderiza o dialog quando documentoId é null", () => {
    renderComponente(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra os dados do documento", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);

    expect(
      await screen.findByText("Alvará de Funcionamento"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Niterói · Regularização e licenciamento"),
    ).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.getByText("60 dias")).toBeInTheDocument();
  });

  it("mostra erro quando a busca do documento falha", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    renderComponente(55);

    expect(
      await screen.findByText(/não foi possível carregar o documento/i),
    ).toBeInTheDocument();
  });

  it("mostra o alerta de prazo pra documento vencido", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido", validade: diasAtras(12) }),
    );
    renderComponente(55);

    expect(await screen.findByText(/vencido há 12 dias/i)).toBeInTheDocument();
  });

  it("mostra só a evidência vigente por padrão, com link de download", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ evidencia_vigente: 2 }),
    );
    vi.mocked(listarEvidenciasLegalizacao).mockResolvedValue([
      evidencia({ id: 1, nome_original: "antiga.pdf", vigente: false }),
      evidencia({
        id: 2,
        nome_original: "atual.pdf",
        vigente: true,
        arquivo: "https://example.com/atual.pdf",
      }),
    ]);
    renderComponente(55);

    expect(await screen.findByText("atual.pdf")).toBeInTheDocument();
    expect(screen.getByText("Vigente")).toBeInTheDocument();
    expect(screen.queryByText("antiga.pdf")).not.toBeInTheDocument();
    const link = screen.getByTitle("Baixar") as HTMLAnchorElement;
    expect(link.href).toBe("https://example.com/atual.pdf");
  });

  it("usa documento.evidencia_vigente (não o flag por-evidência) como fonte de verdade", async () => {
    // Simula uma divergência entre as duas fontes (achado em code review):
    // o item com o flag vigente:true não é o mesmo que documento.
    // evidencia_vigente aponta -- o FK do documento precisa vencer.
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ evidencia_vigente: 1 }),
    );
    vi.mocked(listarEvidenciasLegalizacao).mockResolvedValue([
      evidencia({ id: 1, nome_original: "real-vigente.pdf", vigente: false }),
      evidencia({
        id: 2,
        nome_original: "flag-desatualizado.pdf",
        vigente: true,
      }),
    ]);
    renderComponente(55);

    expect(await screen.findByText("real-vigente.pdf")).toBeInTheDocument();
    expect(
      screen.queryByText("flag-desatualizado.pdf"),
    ).not.toBeInTheDocument();
  });

  it("mostra esqueleto de carregamento nas abas, não 'nenhum registro', enquanto evidências/histórico ainda não resolveram", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    let resolverEvidencias!: (valor: EvidenciaRegulatoria[]) => void;
    vi.mocked(listarEvidenciasLegalizacao).mockReturnValue(
      new Promise((resolve) => {
        resolverEvidencias = resolve;
      }),
    );
    renderComponente(55);

    // Documento já carregou (o cabeçalho aparece), mas evidências ainda não
    // resolveram -- não pode mostrar "Nenhuma evidência enviada ainda.", que
    // é uma afirmação factual errada enquanto a resposta está em voo.
    expect(
      await screen.findByText("Alvará de Funcionamento"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma evidência enviada ainda."),
    ).not.toBeInTheDocument();

    resolverEvidencias([]);
    expect(
      await screen.findByText("Nenhuma evidência enviada ainda."),
    ).toBeInTheDocument();
  });

  it("'Ver histórico de evidências' expande as anteriores; 'Ver só a vigente' recolhe de novo", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ evidencia_vigente: 2 }),
    );
    vi.mocked(listarEvidenciasLegalizacao).mockResolvedValue([
      evidencia({ id: 1, nome_original: "antiga.pdf", vigente: false }),
      evidencia({ id: 2, nome_original: "atual.pdf", vigente: true }),
    ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("atual.pdf");

    await user.click(
      screen.getByRole("button", { name: /ver histórico de evidências/i }),
    );
    expect(screen.getByText("antiga.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver só a vigente" }));
    expect(screen.queryByText("antiga.pdf")).not.toBeInTheDocument();
  });

  it("mostra o histórico, com 'Sistema' quando não há usuário (ação automática), e traduz o status pro rótulo (não o código cru)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([
      historico({
        usuario: null,
        acao: "status",
        valor_anterior: "em_andamento",
        valor_novo: "vencido",
      }),
    ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("tab", { name: /histórico/i }));

    expect(screen.getByText("Sistema")).toBeInTheDocument();
    expect(screen.getByText('"Em andamento"')).toBeInTheDocument();
    expect(screen.getByText('"Vencido"')).toBeInTheDocument();
    expect(screen.queryByText('"em_andamento"')).not.toBeInTheDocument();
  });

  it("traduz o status do processo de renovação no histórico (acao processo_status)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([
      historico({
        acao: "processo_status",
        valor_anterior: "em_andamento",
        valor_novo: "concluido",
      }),
    ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("tab", { name: /histórico/i }));

    expect(screen.getByText('"Em andamento"')).toBeInTheDocument();
    expect(screen.getByText('"Concluído"')).toBeInTheDocument();
  });

  it("não traduz valores de ações que já são texto livre (ex.: observações do protocolo)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([
      historico({
        acao: "processo_observacoes",
        valor_anterior: "",
        valor_novo: "Aguardando retorno da Prefeitura.",
      }),
    ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("tab", { name: /histórico/i }));

    expect(
      screen.getByText('"Aguardando retorno da Prefeitura."'),
    ).toBeInTheDocument();
  });

  it("'Marcar como Não aplicável' exige justificativa antes de confirmar", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    );
    const botaoConfirmar = screen.getByRole("button", { name: "Confirmar" });
    expect(botaoConfirmar).toBeDisabled();

    await user.type(
      screen.getByLabelText(/justificativa/i),
      "Unidade não tem esse serviço.",
    );
    expect(botaoConfirmar).toBeEnabled();
    await user.click(botaoConfirmar);

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(55, {
        status: "nao_aplicavel",
        justificativa_excecao: "Unidade não tem esse serviço.",
      });
    });
  });

  it("'Marcar como Não aplicável' mostra sucesso e fecha o formulário assim que o PATCH resolve, sem esperar a revalidação", async () => {
    // A revalidação pós-PATCH (mutate()) nunca deve ser capaz de reclassificar
    // uma ação já persistida como erro -- separar as duas chamadas (achado em
    // code review) significa que sucesso/fechar o formulário não fica preso
    // esperando ninguém além do próprio PATCH.
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    );
    await user.type(
      screen.getByLabelText(/justificativa/i),
      "Unidade não tem esse serviço.",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Documento marcado como Não aplicável.",
      );
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/justificativa/i)).not.toBeInTheDocument();
  });

  it("'Marcar como Não aplicável' mostra erro e mantém o formulário quando o PATCH falha de verdade", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    );
    await user.type(
      screen.getByLabelText(/justificativa/i),
      "Unidade não tem esse serviço.",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/justificativa/i)).toBeInTheDocument();
  });

  it("'Marcar como Não aplicável' revalida o histórico (a própria ação grava um registro)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel" }),
    );
    vi.mocked(listarHistoricoLegalizacao)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        historico({
          acao: "status",
          valor_anterior: "regular",
          valor_novo: "nao_aplicavel",
        }),
      ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    );
    await user.type(
      screen.getByLabelText(/justificativa/i),
      "Unidade não tem esse serviço.",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("tab", { name: /histórico/i }));

    expect(await screen.findByText('"Não aplicável"')).toBeInTheDocument();
  });

  it("esconde 'Registrar renovação' e 'Marcar como Não aplicável' quando já é Não aplicável", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel", justificativa_excecao: "x" }),
    );
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", { name: "Registrar renovação" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar como Não aplicável" }),
    ).not.toBeInTheDocument();
  });

  it("esconde 'Reverter para aplicável' quando o documento é Regular", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", { name: "Reverter para aplicável" }),
    ).not.toBeInTheDocument();
  });

  it.each(["nao_aplicavel", "unidade_encerramento"] as const)(
    "mostra 'Reverter para aplicável' e esconde 'Marcar como Não aplicável' quando o documento está %s",
    async (status) => {
      // Achado em análise própria de falhas críticas: antes desta issue,
      // "Marcar como Não aplicável" também aparecia em Unidade em
      // encerramento (transição coringa válida no backend) -- sem excluir
      // aqui, as duas ações opostas ficavam visíveis juntas.
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ status, justificativa_excecao: "x" }),
      );
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      expect(
        screen.getByRole("button", { name: "Reverter para aplicável" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Marcar como Não aplicável" }),
      ).not.toBeInTheDocument();
    },
  );

  it("'Reverter para aplicável' não exige justificativa -- confirmar chama a API sem payload", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel", justificativa_excecao: "x" }),
    );
    vi.mocked(reverterDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_iniciado", justificativa_excecao: "" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Reverter para aplicável" }),
    );
    expect(
      screen.getByText(/o status é recalculado pela validade/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reverter" }));

    await waitFor(() => {
      expect(reverterDocumentoLegalizacao).toHaveBeenCalledWith(55);
    });
  });

  it("'Reverter para aplicável' mostra sucesso e revalida documento e histórico", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_aplicavel", justificativa_excecao: "x" }),
    );
    vi.mocked(reverterDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "nao_iniciado", justificativa_excecao: "" }),
    );
    vi.mocked(listarHistoricoLegalizacao)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        historico({
          acao: "status",
          valor_anterior: "nao_aplicavel",
          valor_novo: "nao_iniciado",
        }),
      ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Reverter para aplicável" }),
    );
    await user.click(screen.getByRole("button", { name: "Reverter" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Documento revertido para aplicável.",
      );
    });
    expect(toast.error).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: /histórico/i }));
    expect(await screen.findByText('"Não iniciado"')).toBeInTheDocument();
  });

  it("'Reverter para aplicável' mostra erro quando a API falha", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "unidade_encerramento", justificativa_excecao: "x" }),
    );
    vi.mocked(reverterDocumentoLegalizacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Reverter para aplicável" }),
    );
    await user.click(screen.getByRole("button", { name: "Reverter" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(["em_andamento", "protocolado"] as const)(
    "troca 'Registrar renovação' por 'Acompanhar Renovação' quando já existe um processo em curso (status %s)",
    async (status) => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ status }),
      );
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      expect(
        screen.queryByRole("button", { name: "Registrar renovação" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Acompanhar Renovação",
        }),
      ).toBeInTheDocument();
    },
  );

  it("'Registrar renovação' abre o modal de Processo de Renovação, sem criar nada até confirmar", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Registrar renovação" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Processo de Renovação" }),
    ).toBeInTheDocument();
    expect(criarProcessoRenovacao).not.toHaveBeenCalled();
  });

  it("'Cancelar' no modal de Processo de Renovação fecha sem criar nada", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    await user.click(
      screen.getByRole("button", { name: "Registrar renovação" }),
    );
    await screen.findByRole("heading", { name: "Processo de Renovação" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Processo de Renovação" }),
      ).not.toBeInTheDocument();
    });
    expect(criarProcessoRenovacao).not.toHaveBeenCalled();
  });

  it("Confirmar no modal de Processo de Renovação cria o processo e atualiza o documento", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido" }),
    );
    vi.mocked(criarProcessoRenovacao).mockResolvedValue({
      id: 1,
      documento_unidade: documento({ status: "em_andamento" }),
      status: "em_andamento",
      data_solicitacao: null,
      protocolo_numero: "",
      protocolo_orgao: "",
      protocolo_data: null,
      observacoes: "",
      data_conclusao: null,
      usuario_responsavel: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    await user.click(
      screen.getByRole("button", { name: "Registrar renovação" }),
    );
    await screen.findByRole("heading", { name: "Processo de Renovação" });

    await user.click(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    );

    await waitFor(() => {
      expect(criarProcessoRenovacao).toHaveBeenCalledWith({
        documento_unidade: 55,
        usuario_responsavel: 7,
      });
    });
    expect(
      await screen.findByRole("button", { name: "Salvar protocolo" }),
    ).toBeInTheDocument();
  });

  it("Confirmar no modal de Processo de Renovação invalida a lista de documentos por trás do modal", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido" }),
    );
    vi.mocked(criarProcessoRenovacao).mockResolvedValue({
      id: 1,
      documento_unidade: documento({ status: "em_andamento" }),
      status: "em_andamento",
      data_solicitacao: null,
      protocolo_numero: "",
      protocolo_orgao: "",
      protocolo_data: null,
      observacoes: "",
      data_conclusao: null,
      usuario_responsavel: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderComComListaPorTras(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", { name: "Registrar renovação" }),
    );
    await screen.findByRole("heading", { name: "Processo de Renovação" });
    await user.click(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    );

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(2);
    });
  });

  it("Confirmar no modal de Processo de Renovação revalida o histórico do documento", async () => {
    // Criar o processo grava HistoricoRegulatorio no documento (acao
    // "status", _sincronizar_documento em legalizacao/views.py) -- sem
    // revalidar o histórico aqui, o registro dessa própria ação só aparecia
    // depois de fechar e reabrir o modal (achado em code review).
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "vencido" }),
    );
    vi.mocked(criarProcessoRenovacao).mockResolvedValue({
      id: 1,
      documento_unidade: documento({ status: "em_andamento" }),
      status: "em_andamento",
      data_solicitacao: null,
      protocolo_numero: "",
      protocolo_orgao: "",
      protocolo_data: null,
      observacoes: "",
      data_conclusao: null,
      usuario_responsavel: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => {
      expect(listarHistoricoLegalizacao).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", { name: "Registrar renovação" }),
    );
    await screen.findByRole("heading", { name: "Processo de Renovação" });
    await user.click(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    );

    await waitFor(() => {
      expect(listarHistoricoLegalizacao).toHaveBeenCalledTimes(2);
    });
  });

  it("mostra 'Reportar Movimentação' pra CNES", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ tipo_documento: tipo({ codigo: "cnes", nome: "CNES" }) }),
    );
    renderComponente(55);

    expect(
      await screen.findByRole("button", { name: "Reportar Movimentação" }),
    ).toBeInTheDocument();
  });

  // Achado no dogfooding: tipos rastreados por movimentação profissional
  // (CNES/Dosimetria/CRM/CREMERJ-COREN) não têm ciclo de renovação
  // independente de quem é o profissional responsável -- "vencido" nesses
  // casos só se resolve reportando a entrada de um novo responsável.
  // "Registrar renovação" sozinho é um caminho paralelo sem sentido de
  // negócio pra esses tipos, mesmo antes de virar vencido (regular também).
  it.each(["regular", "vencido"] as const)(
    "esconde 'Registrar renovação' pra CNES com status %s -- só 'Reportar Movimentação' faz sentido",
    async (status) => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ tipo_documento: tipo({ codigo: "cnes", nome: "CNES" }), status }),
      );
      renderComponente(55);

      expect(
        await screen.findByRole("button", { name: "Reportar Movimentação" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Registrar renovação" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["nao_aplicavel", "unidade_encerramento"] as const)(
    "não mostra 'Reportar Movimentação' pra CNES com status %s (backend rejeita, STATUS_CORINGA_COM_JUSTIFICATIVA)",
    async (status) => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({
          tipo_documento: tipo({ codigo: "cnes", nome: "CNES" }),
          status,
          justificativa_excecao: "x",
        }),
      );
      renderComponente(55);
      await screen.findByText("CNES");

      expect(
        screen.queryByRole("button", { name: "Reportar Movimentação" }),
      ).not.toBeInTheDocument();
    },
  );

  it("não mostra 'Reportar Movimentação' pra Alvará", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", { name: "Reportar Movimentação" }),
    ).not.toBeInTheDocument();
  });

  it("clicar em 'Reportar Movimentação' abre o MovimentacaoProfissionalModal (STC-382)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ tipo_documento: tipo({ codigo: "cnes", nome: "CNES" }) }),
    );
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
    const user = userEvent.setup();
    renderComponente(55);

    await user.click(
      await screen.findByRole("button", { name: "Reportar Movimentação" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /reportar movimentação profissional/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("DetalheDocumentoModal -- título diferencia por profissional (STC-432)", () => {
  it("mostra o profissional no título quando o documento é controlado por profissional", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({
        tipo_documento: tipo({
          nome: "Dosimetria",
          controlado_por_profissional: true,
          permite_multiplas_instancias: false,
        }),
        profissional: "Dra. Maria",
      }),
    );
    renderComponente(55);

    // Achado no code review automático: sem o profissional aqui, abrir
    // qualquer uma das linhas de Dosimetria da mesma unidade (uma por
    // profissional) mostrava o mesmo título -- nada diferenciava qual
    // documento estava aberto.
    expect(
      await screen.findByRole("heading", { name: "Dosimetria — Dra. Maria" }),
    ).toBeInTheDocument();
  });

  it("não mostra travessão quando o documento não tem profissional (caso comum)", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);

    expect(
      await screen.findByRole("heading", { name: "Alvará de Funcionamento" }),
    ).toBeInTheDocument();
  });
});

describe("DetalheDocumentoModal -- editar status/validade (STC-502)", () => {
  it("'Editar' abre o formulário pré-preenchido com status/validade atuais, escondendo os botões de ação", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "regular", validade: "2026-12-01" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("button", { name: "Editar documento" }));

    expect(screen.getByLabelText("Status")).toHaveTextContent("Regular");
    expect(screen.getByLabelText("Validade")).toHaveValue("2026-12-01");
    expect(
      screen.queryByRole("button", { name: "Marcar como Não aplicável" }),
    ).not.toBeInTheDocument();
  });

  it("salva o novo status/validade, mostra sucesso, fecha o formulário e revalida documento e histórico", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "em_andamento", validade: null }),
    );
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "regular", validade: "2027-01-01" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    vi.mocked(buscarDocumentoLegalizacao).mockClear();
    vi.mocked(listarHistoricoLegalizacao).mockClear();

    await user.click(screen.getByRole("button", { name: "Editar documento" }));
    await user.click(screen.getByLabelText("Status"));
    await user.click(await screen.findByRole("option", { name: "Regular" }));
    await user.type(screen.getByLabelText("Validade"), "2027-01-01");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(55, {
        status: "regular",
        validade: "2027-01-01",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Documento atualizado.");
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    // Mesmo achado de confirmarNaoAplicavel/reverterParaAplicavel -- sem
    // revalidação explícita, o documento/histórico só atualizavam depois
    // de fechar e reabrir o modal.
    await waitFor(() => {
      expect(buscarDocumentoLegalizacao).toHaveBeenCalled();
      expect(listarHistoricoLegalizacao).toHaveBeenCalled();
    });
  });

  it("bloqueia 'Vencido' sem validade no client, antes de chamar a API", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "regular", validade: "2026-12-01" }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("button", { name: "Editar documento" }));
    await user.click(screen.getByLabelText("Status"));
    await user.click(await screen.findByRole("option", { name: "Vencido" }));
    // Limpa a validade pré-preenchida antes de tentar salvar sem ela.
    await user.clear(screen.getByLabelText("Validade"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Obrigatória para status 'Vencido'."),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("'Cancelar' fecha o formulário sem chamar a API", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("button", { name: "Editar documento" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    ).toBeInTheDocument();
  });

  it("abrir 'Editar' fecha o formulário de 'Marcar como Não aplicável' se estiver aberto, e vice-versa", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Marcar como Não aplicável" }),
    );
    expect(screen.getByLabelText(/justificativa/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar documento" }));

    expect(screen.queryByLabelText(/justificativa/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });
});

describe("DetalheDocumentoModal -- editar Antecedência do alerta (STC-502)", () => {
  it("mostra 'Editar' ao lado da Antecedência quando o documento tem regra_aplicada", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(screen.getByText("60 dias")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar antecedência do alerta" }),
    ).toBeInTheDocument();
  });

  it("não mostra 'Editar' na Antecedência quando o documento não tem regra_aplicada", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ regra_aplicada: null }),
    );
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", { name: "Editar antecedência do alerta" }),
    ).not.toBeInTheDocument();
  });

  it("clicar em 'Editar' na Antecedência abre 'Nova versão da regra' pré-preenchido com este documento", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar antecedência do alerta" }),
    );

    expect(await screen.findByText("Nova versão da regra")).toBeInTheDocument();
    expect(
      screen.getByText(/Alvará de Funcionamento · Niterói/),
    ).toBeInTheDocument();
    // Antecedência atual (60) já vem preenchida -- mesmo comportamento já
    // testado em FormNovaVersaoRegra.test.tsx, só confirmando a integração
    // (documento certo chega no diálogo).
    expect(screen.getByLabelText(/^Antecedência \(dias\)/)).toHaveValue(60);
  });
});

describe("DetalheDocumentoModal -- editar Responsável Operacional (STC-518)", () => {
  it("mostra todos os responsáveis, não só o principal", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({
        responsaveis: [
          { id: 1, usuario: USUARIO, principal: true, created_at: "2026-01-01T00:00:00Z" },
          {
            id: 2,
            usuario: OUTRO_USUARIO,
            principal: false,
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(screen.getByText("Time Legalização")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
  });

  it("'Editar' abre o modo de edição, mostrando os já atribuídos e o gatilho de adicionar", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );

    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remover responsável time legalização/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Adicionar responsável" }),
    ).toBeInTheDocument();
  });

  it("adiciona um segundo responsável (POST com principal: false, já existe um principal)", async () => {
    vi.mocked(buscarDocumentoLegalizacao)
      .mockResolvedValueOnce(documento())
      .mockResolvedValueOnce(
        documento({
          responsaveis: [
            { id: 1, usuario: USUARIO, principal: true, created_at: "2026-01-01T00:00:00Z" },
            {
              id: 2,
              usuario: OUTRO_USUARIO,
              principal: false,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
        }),
      );
    vi.mocked(listarCandidatosResponsaveis).mockResolvedValue([OUTRO_USUARIO]);
    vi.mocked(adicionarResponsavelLegalizacao).mockResolvedValue({
      id: 2,
      usuario: OUTRO_USUARIO,
      principal: false,
      created_at: "2026-01-02T00:00:00Z",
    });
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );
    await user.click(
      screen.getByRole("button", { name: "+ Adicionar responsável" }),
    );
    await user.click(await screen.findByRole("button", { name: "Ana Souza" }));

    await waitFor(() => {
      expect(adicionarResponsavelLegalizacao).toHaveBeenCalledWith(55, {
        usuario_id: OUTRO_USUARIO.id,
        principal: false,
      });
    });
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
  });

  it("adiciona o primeiro responsável de um documento sem nenhum (POST com principal: true)", async () => {
    vi.mocked(buscarDocumentoLegalizacao)
      .mockResolvedValueOnce(documento({ responsaveis: [] }))
      .mockResolvedValueOnce(
        documento({
          responsaveis: [
            { id: 3, usuario: OUTRO_USUARIO, principal: true, created_at: "2026-01-03T00:00:00Z" },
          ],
        }),
      );
    vi.mocked(listarCandidatosResponsaveis).mockResolvedValue([OUTRO_USUARIO]);
    vi.mocked(adicionarResponsavelLegalizacao).mockResolvedValue({
      id: 3,
      usuario: OUTRO_USUARIO,
      principal: true,
      created_at: "2026-01-03T00:00:00Z",
    });
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );
    await user.click(
      screen.getByRole("button", { name: "+ Adicionar responsável" }),
    );
    await user.click(await screen.findByRole("button", { name: "Ana Souza" }));

    await waitFor(() => {
      expect(adicionarResponsavelLegalizacao).toHaveBeenCalledWith(55, {
        usuario_id: OUTRO_USUARIO.id,
        principal: true,
      });
    });
  });

  it("trava os outros candidatos enquanto uma adição está em voo, num documento sem responsável (achado em revisão de falhas críticas)", async () => {
    // Sem isso: documento com 0 responsáveis, clicar rápido em 2
    // candidatos diferentes antes do 1º mutate() resolver -- os dois
    // liam documento.responsaveis.length === 0 (ainda não atualizado) e
    // mandavam principal: true, colidindo com a constraint de único
    // principal no backend (400 confuso em vez do fluxo normal).
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ responsaveis: [] }),
    );
    vi.mocked(listarCandidatosResponsaveis).mockResolvedValue([
      OUTRO_USUARIO,
      TERCEIRO_USUARIO,
    ]);
    let resolverAdicao!: (valor: {
      id: number;
      usuario: Usuario;
      principal: boolean;
      created_at: string;
    }) => void;
    vi.mocked(adicionarResponsavelLegalizacao).mockReturnValue(
      new Promise((resolve) => {
        resolverAdicao = resolve;
      }),
    );
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );
    await user.click(
      screen.getByRole("button", { name: "+ Adicionar responsável" }),
    );
    await user.click(await screen.findByRole("button", { name: "Ana Souza" }));

    // A chamada pra "Ana Souza" ainda não resolveu -- "Bruno Lima" (outro
    // candidato) precisa estar travado, não só o botão da própria Ana.
    expect(screen.getByRole("button", { name: "Bruno Lima" })).toBeDisabled();

    resolverAdicao({
      id: 4,
      usuario: OUTRO_USUARIO,
      principal: true,
      created_at: "2026-01-04T00:00:00Z",
    });
    await waitFor(() => {
      expect(adicionarResponsavelLegalizacao).toHaveBeenCalledTimes(1);
    });
  });

  it("remove um responsável mantendo o outro", async () => {
    vi.mocked(buscarDocumentoLegalizacao)
      .mockResolvedValueOnce(
        documento({
          responsaveis: [
            { id: 1, usuario: USUARIO, principal: true, created_at: "2026-01-01T00:00:00Z" },
            {
              id: 2,
              usuario: OUTRO_USUARIO,
              principal: false,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(documento());
    vi.mocked(removerResponsavelLegalizacao).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );
    await user.click(
      screen.getByRole("button", { name: /remover responsável ana souza/i }),
    );

    await waitFor(() => {
      expect(removerResponsavelLegalizacao).toHaveBeenCalledWith(55, OUTRO_USUARIO.id);
    });
    await waitFor(() => {
      expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Time Legalização")).toBeInTheDocument();
  });

  it("mostra erro claro (não quebra) quando a remoção falha, ex. único responsável principal", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    const erroApi = Object.assign(new Error("Bad Request"), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          usuario_id: [
            "Não é possível remover o único responsável principal. Atribua outro principal antes de remover este.",
          ],
        },
      },
    });
    vi.mocked(removerResponsavelLegalizacao).mockRejectedValue(erroApi);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(
      screen.getByRole("button", { name: "Editar responsável operacional" }),
    );
    await user.click(
      screen.getByRole("button", { name: /remover responsável time legalização/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não é possível remover o único responsável principal. Atribua outro principal antes de remover este.",
      );
    });
    // Não sumiu da tela -- a remoção falhou de verdade, a UI reflete o
    // estado real (ainda responsável), não um estado otimista que já teria
    // tirado o chip antes da confirmação do backend.
    expect(screen.getByText("Time Legalização")).toBeInTheDocument();
  });
});

describe("DetalheDocumentoModal -- editar o identificador (STC-700)", () => {
  const DOSIMETRIA = tipo({ id: 8, nome: "Dosimetria", controlado_por_profissional: true });
  const BALANCA = tipo({ id: 9, nome: "Calibração de Balança", permite_multiplas_instancias: true });

  async function abrirEdicao(doc: DocumentoUnidade) {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(doc);
    const user = userEvent.setup();
    renderComponente(55);
    // O título junta o identificador ao nome do tipo ("Dosimetria — DR. JOÃO").
    await screen.findAllByText(new RegExp(doc.tipo_documento.nome));
    await user.click(screen.getByRole("button", { name: "Editar documento" }));
    return user;
  }

  it("tipo sem identificador não mostra o campo", async () => {
    await abrirEdicao(documento());
    expect(screen.queryByLabelText("Profissional")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Identificador")).not.toBeInTheDocument();
  });

  it("tipo controlado por profissional mostra o campo preenchido, exibido em maiúsculas", async () => {
    await abrirEdicao(documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO" }));
    const campo = screen.getByLabelText("Profissional");
    expect(campo).toHaveValue("DR. JOÃO");
    expect(campo).toHaveClass("uppercase");
  });

  it("tipo com múltiplas instâncias chama o campo de Identificador", async () => {
    await abrirEdicao(documento({ tipo_documento: BALANCA, profissional: "BALANÇA 01" }));
    expect(screen.getByLabelText("Identificador")).toHaveValue("BALANÇA 01");
  });

  it("salva o identificador normalizado como o backend grava", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(
      documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO SUBSTITUTO" }),
    );
    const user = await abrirEdicao(
      documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO" }),
    );

    await user.clear(screen.getByLabelText("Profissional"));
    await user.type(screen.getByLabelText("Profissional"), "  dr. joão   substituto ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(
        55,
        expect.objectContaining({ profissional: "DR. JOÃO SUBSTITUTO" }),
      );
    });
  });

  it("identificador vazio não salva", async () => {
    const user = await abrirEdicao(
      documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO" }),
    );

    await user.clear(screen.getByLabelText("Profissional"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Obrigatório para este tipo de documento.")).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("nome repetido mostra a mensagem do backend no próprio campo", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            profissional: ["Já existe um documento deste tipo e unidade para este profissional."],
          },
        },
      }),
    );
    const user = await abrirEdicao(
      documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO" }),
    );

    await user.clear(screen.getByLabelText("Profissional"));
    await user.type(screen.getByLabelText("Profissional"), "Dra. Maria");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Já existe um documento deste tipo e unidade para este profissional."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Profissional")).toHaveAttribute("aria-invalid", "true");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("erro do identificador junto com o de outro campo: um no campo, o outro no aviso", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            profissional: ["Já existe um documento deste tipo e unidade para este profissional."],
            validade: ["Data inválida."],
          },
        },
      }),
    );
    const user = await abrirEdicao(
      documento({ tipo_documento: DOSIMETRIA, profissional: "DR. JOÃO" }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Já existe um documento deste tipo e unidade para este profissional."),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Data inválida.");
  });

  it("tipo sem identificador não envia o campo", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = await abrirEdicao(documento());

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(atualizarDocumentoLegalizacao).toHaveBeenCalled());
    expect(vi.mocked(atualizarDocumentoLegalizacao).mock.calls[0][1]).not.toHaveProperty(
      "profissional",
    );
  });
});
