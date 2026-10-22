import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
  ComprovanteProtocolo,
  DocumentoUnidade,
  EvidenciaRegulatoria,
  HistoricoRegulatorio,
  ProcessoRenovacao,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { DetalheDocumentoModal } from "./DetalheDocumentoModal";

vi.mock("@/lib/legalizacao");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Sessão padrão sem permissão de excluir; os testes da exclusão (STC-703)
// trocam o perfil em `sessao.atual`.
const sessao = vi.hoisted(() => {
  const padrao = {
    user: {
      usuarioId: 7,
      unidade_id: null as number | null,
      redes_administradas: [] as ("padrao" | "opex")[],
    },
    perfil: null,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: false,
    isSetorLeg: false,
    isCoordenacaoUnidade: false,
  };
  return { padrao, atual: { ...padrao } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => sessao.atual }));

// Admin Operações: administra a rede padrão, a do documento dos testes.
const ADMIN_OPERACOES = {
  isAdminOps: true,
  user: { usuarioId: 7, unidade_id: null, redes_administradas: ["padrao" as const] },
};

import {
  adicionarResponsavelLegalizacao,
  atualizarDocumentoLegalizacao,
  buscarDocumentoLegalizacao,
  comentarNoDocumento,
  criarProcessoRenovacao,
  excluirDocumentoLegalizacao,
  listarCandidatosResponsaveis,
  listarDocumentosLegalizacao,
  listarEvidenciasLegalizacao,
  listarComentariosDoDocumento,
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
    justificativa: "",
    created_at: "2026-08-15T03:00:00Z",
    ...overrides,
  };
}

function comprovante(
  overrides: Partial<ComprovanteProtocolo> = {},
): ComprovanteProtocolo {
  return {
    id: 31,
    processo_renovacao: 9,
    usuario: USUARIO,
    arquivo: "https://r2.exemplo/protocolos/a.pdf",
    nome_original: "protocolo.pdf",
    tamanho_bytes: 2048,
    created_at: "2026-06-03T13:30:00Z",
    ...overrides,
  };
}

function processo(
  overrides: Partial<ProcessoRenovacao> = {},
): ProcessoRenovacao {
  return {
    id: 9,
    documento_unidade: documento(),
    status: "em_andamento",
    data_solicitacao: null,
    protocolo_numero: "",
    protocolo_orgao: "",
    protocolo_data: null,
    observacoes: "",
    data_conclusao: null,
    usuario_responsavel: null,
    comprovantes_protocolo: [],
    card_kanban: null,
    lote: null,
    created_at: "2026-06-02T10:00:00Z",
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
  sessao.atual = { ...sessao.padrao, user: { ...sessao.padrao.user } };
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
      comprovantes_protocolo: [],
      card_kanban: null,
      lote: null,
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
      comprovantes_protocolo: [],
      card_kanban: null,
      lote: null,
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
      comprovantes_protocolo: [],
      card_kanban: null,
      lote: null,
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

  // STC-796: a Legalização renova esses documentos sem que ninguém entre ou
  // saia; os dois caminhos convivem.
  it.each([
    ["cnes", "regular"],
    ["cnes", "vencido"],
    ["dosimetria", "vencido"],
    ["registro-cremerj", "regular"],
    ["registro-coren", "vencido"],
  ] as const)(
    "%s com status %s: 'Registrar renovação' e 'Reportar Movimentação' (STC-796)",
    async (codigo, status) => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ tipo_documento: tipo({ codigo, nome: codigo }), status }),
      );
      renderComponente(55);

      expect(
        await screen.findByRole("button", { name: "Reportar Movimentação" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Registrar renovação" })).toBeInTheDocument();
    },
  );

  it.each(["em_andamento", "protocolado"] as const)(
    "CNES com processo em curso (%s): sem 'Registrar renovação', como os outros documentos (STC-796)",
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
    await user.type(screen.getByLabelText("Justificativa"), "  Licença emitida.  ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(55, {
        status: "regular",
        validade: "2027-01-01",
        justificativa_status: "Licença emitida.",
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

describe("DetalheDocumentoModal -- status livre com justificativa (STC-834)", () => {
  async function abrirEdicao(doc: DocumentoUnidade, processos: ProcessoRenovacao[] = []) {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(doc);
    vi.mocked(listarProcessosRenovacao).mockResolvedValue(processos);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => expect(listarProcessosRenovacao).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Editar documento" }));
    return user;
  }

  async function escolherStatus(user: ReturnType<typeof userEvent.setup>, nome: string) {
    await user.click(screen.getByLabelText("Status"));
    await user.click(await screen.findByRole("option", { name: nome }));
  }

  it("a justificativa só aparece quando o status muda, e é obrigatória", async () => {
    const user = await abrirEdicao(documento({ status: "regular", validade: "2027-12-01" }));

    expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument();
    await escolherStatus(user, "Protocolado");
    expect(screen.getByLabelText("Justificativa")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Justificativa"), "   ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Obrigatória para mudar o status.")).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();

    await escolherStatus(user, "Regular");
    expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument();
  });

  it("oferece os cinco status, inclusive fora da antiga sequência", async () => {
    const user = await abrirEdicao(documento({ status: "regular", validade: "2027-12-01" }));

    await user.click(screen.getByLabelText("Status"));

    for (const nome of ["Não iniciado", "Em andamento", "Protocolado", "Regular", "Vencido"]) {
      expect(await screen.findByRole("option", { name: nome })).toBeInTheDocument();
    }
  });

  it("edição sem mudar o status não pede nem envia justificativa", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue(documento());
    const user = await abrirEdicao(documento({ status: "regular", validade: "2027-12-01" }));

    await user.clear(screen.getByLabelText("Validade"));
    await user.type(screen.getByLabelText("Validade"), "2028-01-01");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(atualizarDocumentoLegalizacao).toHaveBeenCalled());
    expect(vi.mocked(atualizarDocumentoLegalizacao).mock.calls[0][1]).not.toHaveProperty(
      "justificativa_status",
    );
  });

  it("Regular com validade vencida é recusado antes de chamar a API", async () => {
    const user = await abrirEdicao(documento({ status: "vencido", validade: diasAtras(10) }));

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Justificativa"), "Renovado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "A validade está vencida: atualize a validade para marcar como Regular.",
      ),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("com renovação aberta, Regular pede confirmação; cancelar não envia nada", async () => {
    const user = await abrirEdicao(documento({ status: "em_andamento", validade: null }), [
      processo(),
    ]);

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Validade"), "2027-06-30");
    await user.type(screen.getByLabelText("Justificativa"), "Já renovado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "Este documento tem uma renovação em andamento. Ela será concluída junto, e o card no Kanban vai para Concluído.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("confirmando, envia e avisa que a renovação foi concluída junto", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue({
      ...documento({ status: "regular", validade: "2027-06-30" }),
      renovacao_concluida_junto: true,
    });
    const user = await abrirEdicao(documento({ status: "em_andamento", validade: null }), [
      processo(),
    ]);

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Validade"), "2027-06-30");
    await user.type(screen.getByLabelText("Justificativa"), "Já renovado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.click(await screen.findByRole("button", { name: "Marcar como Regular" }));

    await waitFor(() =>
      expect(atualizarDocumentoLegalizacao).toHaveBeenCalledWith(55, {
        status: "regular",
        validade: "2027-06-30",
        justificativa_status: "Já renovado.",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Documento atualizado. A renovação foi concluída junto, e o card foi para Concluído.",
    );
  });

  it("Protocolado sem renovação aberta avisa que a renovação foi aberta junto", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockResolvedValue({
      ...documento({ status: "protocolado", validade: "2027-12-01" }),
      renovacao_aberta_junto: true,
    });
    const user = await abrirEdicao(documento({ status: "regular", validade: "2027-12-01" }));
    vi.mocked(listarProcessosRenovacao).mockClear();

    await escolherStatus(user, "Protocolado");
    await user.type(screen.getByLabelText("Justificativa"), "Protocolo já enviado ao órgão.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Documento atualizado. A renovação foi aberta junto: acompanhe em "Acompanhar Renovação".',
      ),
    );
    // A lista de processos é buscada de novo: "Acompanhar Renovação" já
    // mostra o processo aberto.
    await waitFor(() => expect(listarProcessosRenovacao).toHaveBeenCalled());
  });

  it("enquanto a lista de processos carrega, o Salvar espera", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "em_andamento", validade: null }),
    );
    vi.mocked(listarProcessosRenovacao).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("button", { name: "Editar documento" }));

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("se a lista de processos falhou, Regular confirma assim mesmo", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ status: "em_andamento", validade: null }),
    );
    vi.mocked(listarProcessosRenovacao).mockRejectedValue(new Error("falhou"));
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => expect(listarProcessosRenovacao).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Editar documento" }));

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Validade"), "2027-06-30");
    await user.type(screen.getByLabelText("Justificativa"), "Já renovado.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "Não foi possível conferir se este documento tem uma renovação em andamento. Se tiver, ela será concluída junto, e o card no Kanban vai para Concluído.",
      ),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("com renovação aberta, Regular sem validade pede a validade nova", async () => {
    const user = await abrirEdicao(documento({ status: "em_andamento", validade: null }), [
      processo(),
    ]);

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Justificativa"), "Já renovado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Informe a nova validade para concluir a renovação."),
    ).toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("renovação de lote: Regular é recusado no campo Status, sem confirmação", async () => {
    const user = await abrirEdicao(documento({ status: "em_andamento", validade: null }), [
      processo({ lote: 4 }),
    ]);

    await escolherStatus(user, "Regular");
    await user.type(screen.getByLabelText("Validade"), "2027-06-30");
    await user.type(screen.getByLabelText("Justificativa"), "Já renovado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/faz parte de um lote/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como Regular" })).not.toBeInTheDocument();
    expect(atualizarDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("recusa do backend na validade aparece no campo, sem fechar a edição", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { validade: ["Informe a nova validade para concluir a renovação."] },
        },
      }),
    );
    const user = await abrirEdicao(documento({ status: "regular", validade: "2027-12-01" }));

    await escolherStatus(user, "Protocolado");
    await user.type(screen.getByLabelText("Justificativa"), "Protocolo enviado.");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Informe a nova validade para concluir a renovação."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a justificativa aparece no histórico", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([
      historico({ justificativa: "Status lançado errado." }),
    ]);
    const user = userEvent.setup();
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("tab", { name: /histórico/i }));

    expect(await screen.findByText("Status lançado errado.")).toBeInTheDocument();
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

  it("erro do identificador junto com um erro geral: um no campo, o outro no aviso", async () => {
    vi.mocked(atualizarDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            profissional: ["Já existe um documento deste tipo e unidade para este profissional."],
            non_field_errors: ["Data inválida."],
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


describe("DetalheDocumentoModal -- excluir documento (STC-703)", () => {
  const BOTAO = { name: "Excluir documento" };

  async function abrir(
    doc: DocumentoUnidade = documento(),
    onOpenChange: (open: boolean) => void = vi.fn(),
  ) {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(doc);
    renderComponente(55, onOpenChange);
    await screen.findAllByText(new RegExp(doc.tipo_documento.nome));
  }

  it.each([
    ["Admin", ADMIN_OPERACOES],
    ["Setor de Legalização", { isSetorLeg: true }],
  ])("%s vê o botão", async (_perfil, flags) => {
    sessao.atual = { ...sessao.atual, ...flags };
    await abrir();
    expect(screen.getByRole("button", BOTAO)).toBeInTheDocument();
  });

  it("Admin de outra rede não vê o botão (STC-747)", async () => {
    sessao.atual = {
      ...sessao.atual,
      isAdminOps: true,
      user: { ...sessao.atual.user, redes_administradas: ["opex"] },
    };
    await abrir();
    expect(screen.queryByRole("button", BOTAO)).not.toBeInTheDocument();
  });

  it("Coordenação vê o botão só nos documentos da própria unidade", async () => {
    sessao.atual = {
      ...sessao.atual,
      isCoordenacaoUnidade: true,
      user: { ...sessao.atual.user, unidade_id: UNIDADE.id },
    };
    await abrir();
    expect(screen.getByRole("button", BOTAO)).toBeInTheDocument();
  });

  it("Coordenação de outra unidade não vê o botão", async () => {
    sessao.atual = {
      ...sessao.atual,
      isCoordenacaoUnidade: true,
      user: { ...sessao.atual.user, unidade_id: UNIDADE.id + 100 },
    };
    await abrir();
    expect(screen.queryByRole("button", BOTAO)).not.toBeInTheDocument();
  });

  it("quem não pode escrever no documento não vê o botão", async () => {
    await abrir();
    expect(screen.queryByRole("button", BOTAO)).not.toBeInTheDocument();
  });

  it("a confirmação diz o que vai sair, e cancelar não exclui", async () => {
    sessao.atual = { ...sessao.atual, ...ADMIN_OPERACOES };
    vi.mocked(listarEvidenciasLegalizacao).mockResolvedValue([evidencia()]);
    const user = userEvent.setup();
    await abrir(documento({ profissional: "BALANÇA 01" }));

    await user.click(screen.getByRole("button", BOTAO));
    const confirmacao = await screen.findByRole("alertdialog");
    expect(confirmacao).toHaveTextContent(
      "O documento Alvará de Funcionamento — BALANÇA 01 da unidade " +
        `${UNIDADE.nome} será excluído, com 1 evidência, o histórico`,
    );
    expect(confirmacao).toHaveTextContent("Essa ação não pode ser desfeita.");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(excluirDocumentoLegalizacao).not.toHaveBeenCalled();
  });

  it("confirmar exclui, avisa e fecha o detalhe", async () => {
    sessao.atual = { ...sessao.atual, isSetorLeg: true };
    vi.mocked(excluirDocumentoLegalizacao).mockResolvedValue();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    await abrir(documento(), onOpenChange);

    await user.click(screen.getByRole("button", BOTAO));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(excluirDocumentoLegalizacao).toHaveBeenCalledWith(55));
    expect(toast.success).toHaveBeenCalledWith("Documento excluído.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("depois de excluir, a lista da Matriz por trás é atualizada", async () => {
    sessao.atual = { ...sessao.atual, ...ADMIN_OPERACOES };
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(excluirDocumentoLegalizacao).mockResolvedValue();
    const user = userEvent.setup();
    renderComComListaPorTras(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", BOTAO));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(2));
  });

  it("documento já excluído por outra pessoa: avisa, fecha e atualiza as listas", async () => {
    sessao.atual = { ...sessao.atual, ...ADMIN_OPERACOES };
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(excluirDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Not Found"), {
        isAxiosError: true,
        response: { status: 404, data: { detail: "Não encontrado." } },
      }),
    );
    const user = userEvent.setup();
    renderComComListaPorTras(55);
    await screen.findByText("Alvará de Funcionamento");
    await waitFor(() => expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", BOTAO));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("Este documento já tinha sido excluído."),
    );
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(2));
  });

  it("enquanto as evidências carregam, a confirmação não mostra número", async () => {
    sessao.atual = { ...sessao.atual, ...ADMIN_OPERACOES };
    vi.mocked(listarEvidenciasLegalizacao).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await abrir();

    await user.click(screen.getByRole("button", BOTAO));

    const confirmacao = await screen.findByRole("alertdialog");
    expect(confirmacao).toHaveTextContent("será excluído, com as evidências, o histórico");
    expect(confirmacao).not.toHaveTextContent("0 evidências");
  });

  it("erro do backend aparece legível e o detalhe continua aberto", async () => {
    sessao.atual = { ...sessao.atual, ...ADMIN_OPERACOES };
    vi.mocked(excluirDocumentoLegalizacao).mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { detail: "Você não tem permissão para executar essa ação." } },
      }),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    await abrir(documento(), onOpenChange);

    await user.click(screen.getByRole("button", BOTAO));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para executar essa ação."),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  describe("documentos de protocolo (STC-772)", () => {
    it("aba Protocolo lista os comprovantes de cada renovação, com quem anexou, quando e download", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([
        processo({
          id: 12,
          protocolo_numero: "2026/00184-LIC",
          created_at: "2026-09-10T15:00:00Z",
          comprovantes_protocolo: [
            comprovante({ id: 41, processo_renovacao: 12, nome_original: "protocolo-atual.pdf" }),
          ],
        }),
        // Renovação sem comprovante não aparece na aba.
        processo({ id: 11, status: "concluido", created_at: "2025-09-01T15:00:00Z" }),
        processo({
          id: 9,
          status: "concluido",
          created_at: "2024-09-02T15:00:00Z",
          comprovantes_protocolo: [
            comprovante({
              id: 31,
              nome_original: "protocolo-2024.pdf",
              usuario: OUTRO_USUARIO,
              arquivo: "https://r2.exemplo/protocolos/2024.pdf",
            }),
          ],
        }),
      ]);
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      const aba = screen.getByRole("tab", { name: /protocolo/i });
      expect(aba).toHaveTextContent("2");
      await user.click(aba);

      expect(await screen.findByText("Renovação de 10/09/2026")).toBeInTheDocument();
      expect(screen.getByText(/Em andamento · Protocolo 2026\/00184-LIC/)).toBeInTheDocument();
      expect(screen.getByText("Renovação de 02/09/2024")).toBeInTheDocument();
      expect(screen.queryByText("Renovação de 01/09/2025")).not.toBeInTheDocument();
      expect(screen.getByText("protocolo-atual.pdf")).toBeInTheDocument();
      expect(
        screen.getByText(/enviado por Ana Souza/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Baixar protocolo-2024.pdf" }),
      ).toHaveAttribute("href", "https://r2.exemplo/protocolos/2024.pdf");
    });

    it("aba Protocolo sem contagem enquanto a lista carrega ou se ela falhar", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      let falhar: (erro: Error) => void = () => {};
      vi.mocked(listarProcessosRenovacao).mockReturnValue(
        new Promise((_resolver, rejeitar) => {
          falhar = rejeitar;
        }),
      );
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      const aba = screen.getByRole("tab", { name: /protocolo/i });
      expect(aba).toHaveTextContent(/^Protocolo$/);

      falhar(new Error("Falha de rede."));
      await user.click(aba);
      expect(
        await screen.findByText(/Não foi possível carregar os documentos de protocolo/),
      ).toBeInTheDocument();
      expect(aba).toHaveTextContent(/^Protocolo$/);
    });

    it("aba Protocolo sem comprovante mostra o vazio", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      const aba = screen.getByRole("tab", { name: /protocolo/i });
      await user.click(aba);

      expect(
        await screen.findByText("Nenhum documento de protocolo anexado ainda."),
      ).toBeInTheDocument();
      expect(aba).toHaveTextContent("Protocolo0");
    });

    it("histórico mostra o anexo do comprovante de protocolo", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarHistoricoLegalizacao).mockResolvedValue([
        historico({
          acao: "comprovante_protocolo",
          valor_anterior: "",
          valor_novo: "protocolo.pdf",
        }),
      ]);
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      await user.click(screen.getByRole("tab", { name: /histórico/i }));

      expect(screen.getByText("comprovante de protocolo")).toBeInTheDocument();
      expect(screen.getByText('"protocolo.pdf"')).toBeInTheDocument();
    });
  });

  describe("comentários do documento (STC-774)", () => {
    function comentario(id: number, texto: string) {
      return { id, usuario: USUARIO, texto, created_at: "2026-06-03T13:30:00Z" };
    }

    it("aba Comentários com a contagem, a conversa e o envio, mesmo sem renovação", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([]);
      vi.mocked(listarComentariosDoDocumento).mockResolvedValue([
        comentario(1, "Aguardando a prefeitura."),
        comentario(2, "Prefeitura respondeu."),
      ]);
      vi.mocked(comentarNoDocumento).mockResolvedValue(comentario(3, "Ok."));
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      const aba = screen.getByRole("tab", { name: /comentários/i });
      await waitFor(() => expect(aba).toHaveTextContent("Comentários2"));
      await user.click(aba);

      expect(await screen.findByText("Prefeitura respondeu.")).toBeInTheDocument();
      expect(listarComentariosDoDocumento).toHaveBeenCalledWith(55);
      await user.type(
        screen.getByPlaceholderText("Adicionar comentário... (Enter para enviar)"),
        "Ok.{Enter}",
      );
      await waitFor(() => {
        expect(comentarNoDocumento).toHaveBeenCalledWith(55, "Ok.");
      });
    });

    it("sem contagem na aba enquanto a conversa carrega", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarComentariosDoDocumento).mockReturnValue(new Promise(() => {}));
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      expect(screen.getByRole("tab", { name: /comentários/i })).toHaveTextContent(
        /^Comentários$/,
      );
    });

    it("documento sem comentários mostra o vazio e aceita o primeiro", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      vi.mocked(listarComentariosDoDocumento).mockResolvedValue([]);
      const user = userEvent.setup();
      renderComponente(55);
      await screen.findByText("Alvará de Funcionamento");

      await user.click(screen.getByRole("tab", { name: /comentários/i }));

      expect(await screen.findByText("Nenhum comentário ainda.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Adicionar comentário... (Enter para enviar)"),
      ).toBeInTheDocument();
    });
  });

  describe("renovação em lote (STC-779)", () => {
    it("'Renovar em lote' só para tipo de várias instâncias", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ tipo_documento: tipo({ permite_multiplas_instancias: true }) }),
      );
      const { unmount } = renderComponente(55);
      expect(await screen.findByRole("button", { name: "Renovar em lote" })).toBeInTheDocument();
      unmount();

      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
      renderComponente(55);
      await screen.findByRole("button", { name: "Registrar renovação" });
      expect(screen.queryByRole("button", { name: "Renovar em lote" })).not.toBeInTheDocument();
    });

    it("trocar de documento fecha o lote aberto do anterior", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({ tipo_documento: tipo({ permite_multiplas_instancias: true }) }),
      );
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
      const user = userEvent.setup();
      const montar = (documentoId: number | null) => (
        <SWRConfig value={{ provider: () => new Map() }}>
          <DetalheDocumentoModal documentoId={documentoId} onOpenChange={vi.fn()} />
        </SWRConfig>
      );
      const { rerender } = render(montar(55));
      await user.click(await screen.findByRole("button", { name: "Renovar em lote" }));
      expect(
        await screen.findByRole("dialog", { name: "Renovação em lote" }),
      ).toBeInTheDocument();

      // O detalhe fecha por fora (ex.: "voltar" do navegador tira o ?documento=).
      // Pelo título: com o detalhe reaberto, as outras camadas ficam
      // aria-hidden e a busca por papel não acharia um modal que sobrou.
      rerender(montar(null));
      expect(screen.queryByText("Renovação em lote")).not.toBeInTheDocument();

      rerender(montar(56));
      await screen.findByText("Alvará de Funcionamento");
      expect(screen.queryByText("Renovação em lote")).not.toBeInTheDocument();
    });

    it("renovação em curso num lote abre o lote em vez do processo avulso", async () => {
      vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
        documento({
          status: "em_andamento",
          tipo_documento: tipo({ permite_multiplas_instancias: true }),
        }),
      );
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo({ lote: 5 })]);
      renderComponente(55);

      expect(
        await screen.findByRole("button", { name: "Acompanhar lote de renovação" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Acompanhar Renovação" })).not.toBeInTheDocument();
      expect(
        screen.getByText("Esta renovação faz parte de um lote com outras instâncias."),
      ).toBeInTheDocument();
    });
  });
});
