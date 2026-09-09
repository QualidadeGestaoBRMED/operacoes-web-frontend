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

import {
  atualizarDocumentoLegalizacao,
  buscarDocumentoLegalizacao,
  criarProcessoRenovacao,
  listarDocumentosLegalizacao,
  listarEvidenciasLegalizacao,
  listarHistoricoLegalizacao,
  urlAbsolutaDaEvidencia,
} from "@/lib/legalizacao";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
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
    expect(screen.getByText("Alta")).toBeInTheDocument();
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
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
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
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
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

  it("mostra o histórico, com 'Sistema' quando não há usuário (ação automática)", async () => {
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
    expect(screen.getByText('"em_andamento"')).toBeInTheDocument();
    expect(screen.getByText('"vencido"')).toBeInTheDocument();
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

  it.each(["em_andamento", "protocolado"] as const)(
    "esconde 'Registrar renovação' quando já existe um processo em curso (status %s)",
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
        screen.getByText("Processo de renovação em andamento."),
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
      });
    });
    expect(
      await screen.findByText(/solicitação · concluída/i),
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

  it("mostra 'Reportar Movimentação Profissional' pra CNES", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(
      documento({ tipo_documento: tipo({ codigo: "cnes", nome: "CNES" }) }),
    );
    renderComponente(55);

    expect(
      await screen.findByRole("button", {
        name: /reportar movimentação profissional/i,
      }),
    ).toBeInTheDocument();
  });

  it("não mostra 'Reportar Movimentação Profissional' pra Alvará", async () => {
    vi.mocked(buscarDocumentoLegalizacao).mockResolvedValue(documento());
    renderComponente(55);
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", {
        name: /reportar movimentação profissional/i,
      }),
    ).not.toBeInTheDocument();
  });
});
