import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
  ComprovanteProtocolo,
  DocumentoUnidade,
  EvidenciaRegulatoria,
  ProcessoRenovacao,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { ProcessoRenovacaoModal } from "./ProcessoRenovacaoModal";

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
  atualizarProcessoRenovacao,
  comentarNaRenovacao,
  criarProcessoRenovacao,
  enviarComprovanteProtocolo,
  enviarEvidenciaLegalizacao,
  listarComentariosDaRenovacao,
  listarProcessosRenovacao,
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
  id: 7,
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
    status: "vencido",
    justificativa_excecao: "",
    validade: "2026-01-01",
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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
    usuario_responsavel: USUARIO,
    comprovantes_protocolo: [],
    card_kanban: null,
    created_at: "2026-06-02T10:00:00Z",
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
    arquivo: "/media/legalizacao/protocolos/documento_55/a.pdf",
    nome_original: "protocolo-prefeitura.pdf",
    tamanho_bytes: 2048,
    created_at: "2026-06-03T13:30:00Z",
    ...overrides,
  };
}

function renderComponente(
  aberto: boolean,
  onOpenChange: (open: boolean) => void = vi.fn(),
  onAtualizado: () => void = vi.fn(),
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProcessoRenovacaoModal
        documento={documento()}
        aberto={aberto}
        onOpenChange={onOpenChange}
        onAtualizado={onAtualizado}
      />
    </SWRConfig>,
  );
}

// O fuso dos testes é fixado em America/Sao_Paulo no vitest.config.ts:
// "Data da solicitação" precisa converter o datetime UTC pro fuso local antes
// de extrair o dia, não fatiar a string crua (achado em análise de falhas
// críticas).

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarProcessosRenovacao).mockResolvedValue([]);
});

describe("ProcessoRenovacaoModal (STC-381)", () => {
  it("não renderiza quando fechado", () => {
    renderComponente(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("falha ao listar processos", () => {
    it("mostra estado de erro em vez de cair no passo de criação de um novo processo", async () => {
      // Achado no code review automático (PR #36): sem tratar o `error` do
      // hook, um GET que falha deixava processoAtivo=null por falta de
      // dado, e a UI mostrava "Iniciar processo de renovação" como se o
      // documento não tivesse processo nenhum -- mesmo quando o modal só é
      // aberto (via "Acompanhar Renovação") justamente esperando um
      // processo já existente.
      vi.mocked(listarProcessosRenovacao).mockRejectedValue(
        new Error("Falha de rede."),
      );
      renderComponente(true);

      expect(
        await screen.findByText(
          "Não foi possível completar a operação. Tente novamente.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Iniciar processo de renovação" }),
      ).not.toBeInTheDocument();
      expect(criarProcessoRenovacao).not.toHaveBeenCalled();
    });

    it("'Tentar novamente' refaz a listagem", async () => {
      vi.mocked(listarProcessosRenovacao)
        .mockRejectedValueOnce(new Error("Falha de rede."))
        .mockResolvedValueOnce([processo()]);
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByText(
        "Não foi possível completar a operação. Tente novamente.",
      );

      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(
        await screen.findByLabelText("Número do protocolo"),
      ).toBeInTheDocument();
    });
  });

  describe("sem processo ativo", () => {
    it("mostra o passo de confirmação", async () => {
      renderComponente(true);

      expect(
        await screen.findByRole("heading", { name: "Processo de Renovação" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Iniciar processo de renovação",
        }),
      ).toBeInTheDocument();
      expect(criarProcessoRenovacao).not.toHaveBeenCalled();
    });

    it("Cancelar chama onOpenChange(false) sem criar nada", async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, onOpenChange);
      await screen.findByRole("button", {
        name: "Iniciar processo de renovação",
      });

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(criarProcessoRenovacao).not.toHaveBeenCalled();
    });

    it("Confirmar cria o processo com usuario_responsavel do usuário logado e mostra as 3 seções", async () => {
      vi.mocked(criarProcessoRenovacao).mockResolvedValue(processo());
      const onAtualizado = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, vi.fn(), onAtualizado);
      await screen.findByRole("button", {
        name: "Iniciar processo de renovação",
      });

      await user.click(
        screen.getByRole("button", { name: "Iniciar processo de renovação" }),
      );

      await waitFor(() => {
        expect(criarProcessoRenovacao).toHaveBeenCalledWith({
          documento_unidade: 55,
          usuario_responsavel: 7,
        });
      });
      expect(onAtualizado).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Processo de renovação iniciado.",
      );
      expect(
        await screen.findByRole("button", { name: "Salvar protocolo" }),
      ).toBeInTheDocument();
    });

    it("mostra toast de erro e mantém o passo de confirmação quando a criação falha", async () => {
      vi.mocked(criarProcessoRenovacao).mockRejectedValue(
        new Error("Falha de rede."),
      );
      const onAtualizado = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, vi.fn(), onAtualizado);
      await screen.findByRole("button", {
        name: "Iniciar processo de renovação",
      });

      await user.click(
        screen.getByRole("button", { name: "Iniciar processo de renovação" }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(onAtualizado).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Iniciar processo de renovação" }),
      ).toBeInTheDocument();
    });
  });

  describe("com processo ativo", () => {
    it("mostra Solicitação (data + aberto por) e os campos de Protocolo vazios", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);

      expect(await screen.findByText("02/06/2026")).toBeInTheDocument();
      expect(screen.getByText("Time Legalização")).toBeInTheDocument();
      expect(screen.getByLabelText("Número do protocolo")).toHaveValue("");
    });

    it("'Data da solicitação' converte pro fuso local, não fatia o datetime UTC cru", async () => {
      // 01:00 UTC de 03/06 é 22:00 de 02/06 em America/Sao_Paulo (UTC-3) --
      // fatiar a string crua ("2026-06-03...") mostraria o dia errado.
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([
        processo({ created_at: "2026-06-03T01:00:00Z" }),
      ]);
      renderComponente(true);

      expect(await screen.findByText("02/06/2026")).toBeInTheDocument();
      expect(screen.queryByText("03/06/2026")).not.toBeInTheDocument();
    });

    it("pré-preenche o Protocolo com os valores já salvos de um processo protocolado", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([
        processo({
          status: "protocolado",
          protocolo_numero: "2026/00184-LIC",
          protocolo_orgao: "Prefeitura de Niterói",
        }),
      ]);
      renderComponente(true);

      expect(await screen.findByLabelText("Número do protocolo")).toHaveValue(
        "2026/00184-LIC",
      );
      expect(screen.getByLabelText("Órgão")).toHaveValue(
        "Prefeitura de Niterói",
      );
    });

    it("'Salvar protocolo' fica desabilitado sem número, e envia PATCH status=protocolado ao preencher", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(atualizarProcessoRenovacao).mockResolvedValue(
        processo({ status: "protocolado", protocolo_numero: "2026/123" }),
      );
      const onAtualizado = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, vi.fn(), onAtualizado);
      await screen.findByLabelText("Número do protocolo");

      expect(
        screen.getByRole("button", { name: "Salvar protocolo" }),
      ).toBeDisabled();

      await user.type(screen.getByLabelText("Número do protocolo"), "2026/123");
      await user.click(
        screen.getByRole("button", { name: "Salvar protocolo" }),
      );

      await waitFor(() => {
        expect(atualizarProcessoRenovacao).toHaveBeenCalledWith(9, {
          status: "protocolado",
          protocolo_numero: "2026/123",
          protocolo_orgao: "",
          protocolo_data: null,
          observacoes: "",
        });
      });
      expect(onAtualizado).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Protocolo salvo.");
    });

    it("mostra erro quando salvar o protocolo falha", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(atualizarProcessoRenovacao).mockRejectedValue(
        new Error("Falha de rede."),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");
      await user.type(screen.getByLabelText("Número do protocolo"), "2026/1");

      await user.click(
        screen.getByRole("button", { name: "Salvar protocolo" }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("'Concluir renovação' fica desabilitado sem validade e evidência", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      expect(
        screen.getByRole("button", { name: "Concluir renovação" }),
      ).toBeDisabled();
    });

    it("input de evidência aceita só PDF (STC-433)", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      const inputArquivo = screen.getByLabelText("Arquivo da evidência") as HTMLInputElement;

      expect(inputArquivo).toHaveAttribute("accept", ".pdf");
    });

    it("Concluir envia a evidência e depois o PATCH status=concluido com nova_validade", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(enviarEvidenciaLegalizacao).mockResolvedValue({
        id: 1,
        usuario: USUARIO,
        arquivo: "renovado.pdf",
        nome_original: "renovado.pdf",
        tamanho_bytes: 100,
        vigente: true,
        emitido_em: null,
        validade_comprovada: null,
        processo_renovacao: 9,
        created_at: "2026-09-10T00:00:00Z",
      });
      vi.mocked(atualizarProcessoRenovacao).mockResolvedValue(
        processo({ status: "concluido" }),
      );
      const onOpenChange = vi.fn();
      const onAtualizado = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, onOpenChange, onAtualizado);
      await screen.findByLabelText("Número do protocolo");

      await user.type(screen.getByLabelText(/nova validade/i), "2027-06-02");
      const arquivo = new File(["conteudo"], "renovado.pdf", {
        type: "application/pdf",
      });
      const inputArquivo = screen.getByLabelText("Arquivo da evidência") as HTMLInputElement;
      await user.upload(inputArquivo, arquivo);

      await user.click(
        screen.getByRole("button", { name: "Concluir renovação" }),
      );

      await waitFor(() => {
        expect(enviarEvidenciaLegalizacao).toHaveBeenCalledWith(55, arquivo);
      });
      await waitFor(() => {
        expect(atualizarProcessoRenovacao).toHaveBeenCalledWith(9, {
          status: "concluido",
          nova_validade: "2027-06-02",
          protocolo_numero: "",
          protocolo_orgao: "",
          protocolo_data: null,
          observacoes: "",
        });
      });
      expect(onAtualizado).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("'Concluir renovação' envia os campos de Protocolo digitados, mesmo sem clicar em 'Salvar protocolo' antes", async () => {
      // Achado em análise de falhas críticas: sem isto, editar Número/
      // Órgão/Observações e clicar direto em "Concluir renovação" (sem
      // passar por "Salvar protocolo" antes) descartava essas edições em
      // silêncio -- o PATCH de conclusão só mandava status+nova_validade.
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(enviarEvidenciaLegalizacao).mockResolvedValue({
        id: 1,
        usuario: USUARIO,
        arquivo: "renovado.pdf",
        nome_original: "renovado.pdf",
        tamanho_bytes: 100,
        vigente: true,
        emitido_em: null,
        validade_comprovada: null,
        processo_renovacao: 9,
        created_at: "2026-09-10T00:00:00Z",
      });
      vi.mocked(atualizarProcessoRenovacao).mockResolvedValue(
        processo({ status: "concluido" }),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      await user.type(screen.getByLabelText("Número do protocolo"), "2026/999");
      await user.type(
        screen.getByLabelText("Observações"),
        "Concluído sem protocolo formal.",
      );
      await user.type(screen.getByLabelText(/nova validade/i), "2027-06-02");
      const arquivo = new File(["conteudo"], "renovado.pdf", {
        type: "application/pdf",
      });
      const inputArquivo = screen.getByLabelText("Arquivo da evidência") as HTMLInputElement;
      await user.upload(inputArquivo, arquivo);

      await user.click(
        screen.getByRole("button", { name: "Concluir renovação" }),
      );

      await waitFor(() => {
        expect(atualizarProcessoRenovacao).toHaveBeenCalledWith(9, {
          status: "concluido",
          nova_validade: "2027-06-02",
          protocolo_numero: "2026/999",
          protocolo_orgao: "",
          protocolo_data: null,
          observacoes: "Concluído sem protocolo formal.",
        });
      });
    });

    it("'Salvar protocolo' fica desabilitado enquanto a evidência de 'Concluir renovação' está subindo", async () => {
      // Achado no code review automático (PR #36): as duas ações
      // compartilham a mesma instância de useAtualizarProcessoRenovacao().
      // Sem considerar enviandoEvidencia, "Salvar protocolo" continuava
      // clicável durante o upload de "Concluir renovação" -- um clique
      // nessa janela disparava um PATCH status=protocolado concorrente ao
      // PATCH status=concluido que viria em seguida, e o resultado final
      // no servidor passaria a depender de qual chegasse por último.
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      let resolverEnvio: (valor: EvidenciaRegulatoria) => void = () => {};
      vi.mocked(enviarEvidenciaLegalizacao).mockReturnValue(
        new Promise<EvidenciaRegulatoria>((resolve) => {
          resolverEnvio = resolve;
        }),
      );
      vi.mocked(atualizarProcessoRenovacao).mockResolvedValue(
        processo({ status: "concluido" }),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      await user.type(screen.getByLabelText("Número do protocolo"), "2026/1");
      await user.type(screen.getByLabelText(/nova validade/i), "2027-06-02");
      const arquivo = new File(["conteudo"], "renovado.pdf", {
        type: "application/pdf",
      });
      const inputArquivo = screen.getByLabelText("Arquivo da evidência") as HTMLInputElement;
      await user.upload(inputArquivo, arquivo);

      await user.click(
        screen.getByRole("button", { name: "Concluir renovação" }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Salvar protocolo" }),
        ).toBeDisabled();
      });
      expect(atualizarProcessoRenovacao).not.toHaveBeenCalled();

      resolverEnvio({
        id: 1,
        usuario: USUARIO,
        arquivo: "renovado.pdf",
        nome_original: "renovado.pdf",
        tamanho_bytes: 100,
        vigente: true,
        emitido_em: null,
        validade_comprovada: null,
        processo_renovacao: 9,
        created_at: "2026-09-10T00:00:00Z",
      });
      await waitFor(() => {
        expect(atualizarProcessoRenovacao).toHaveBeenCalled();
      });
    });

    it("se o PATCH falhar depois da evidência ter sido enviada, um novo clique não reenvia o arquivo", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(enviarEvidenciaLegalizacao).mockResolvedValue({
        id: 1,
        usuario: USUARIO,
        arquivo: "renovado.pdf",
        nome_original: "renovado.pdf",
        tamanho_bytes: 100,
        vigente: true,
        emitido_em: null,
        validade_comprovada: null,
        processo_renovacao: 9,
        created_at: "2026-09-10T00:00:00Z",
      });
      vi.mocked(atualizarProcessoRenovacao).mockRejectedValue(
        new Error("Falha de rede."),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      await user.type(screen.getByLabelText(/nova validade/i), "2027-06-02");
      const arquivo = new File(["conteudo"], "renovado.pdf", {
        type: "application/pdf",
      });
      const inputArquivo = screen.getByLabelText("Arquivo da evidência") as HTMLInputElement;
      await user.upload(inputArquivo, arquivo);
      await user.click(
        screen.getByRole("button", { name: "Concluir renovação" }),
      );
      await waitFor(() => {
        expect(enviarEvidenciaLegalizacao).toHaveBeenCalledTimes(1);
      });

      await user.click(
        screen.getByRole("button", { name: "Concluir renovação" }),
      );

      await waitFor(() => {
        expect(atualizarProcessoRenovacao).toHaveBeenCalledTimes(2);
      });
      expect(enviarEvidenciaLegalizacao).toHaveBeenCalledTimes(1);
    });
  });

  describe("comprovante de protocolo (STC-772)", () => {
    beforeEach(() => {
      vi.mocked(urlAbsolutaDaEvidencia).mockImplementation((url) => url);
    });

    it("anexa o PDF ao escolher o arquivo e lista com nome, data e download", async () => {
      const anexado = comprovante();
      vi.mocked(listarProcessosRenovacao)
        .mockResolvedValueOnce([processo()])
        .mockResolvedValue([processo({ comprovantes_protocolo: [anexado] })]);
      vi.mocked(enviarComprovanteProtocolo).mockResolvedValue(anexado);
      const onAtualizado = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, vi.fn(), onAtualizado);
      await screen.findByLabelText("Número do protocolo");
      const arquivo = new File(["%PDF"], "protocolo-prefeitura.pdf", {
        type: "application/pdf",
      });

      await user.upload(
        screen.getByLabelText("Arquivo do comprovante de protocolo"),
        arquivo,
      );

      await waitFor(() => {
        expect(enviarComprovanteProtocolo).toHaveBeenCalledWith(9, arquivo);
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Comprovante de protocolo anexado.",
      );
      expect(onAtualizado).toHaveBeenCalled();
      expect(
        await screen.findByText("protocolo-prefeitura.pdf"),
      ).toBeInTheDocument();
      // 13:30 UTC é 10:30 em America/Sao_Paulo (fuso fixado no vitest).
      expect(screen.getByText("03/06/2026 · 10:30")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Baixar protocolo-prefeitura.pdf" }),
      ).toHaveAttribute("href", anexado.arquivo);
      expect(
        screen.getByRole("button", { name: "Anexar outro comprovante" }),
      ).toBeInTheDocument();
    });

    it("aceita só PDF no seletor de arquivo", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      expect(
        screen.getByLabelText("Arquivo do comprovante de protocolo"),
      ).toHaveAttribute("accept", ".pdf");
    });

    it("o botão de anexar leva o título do campo como descrição", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      expect(
        screen.getByRole("button", { name: "Anexar comprovante" }),
      ).toHaveAccessibleDescription("Comprovante de protocolo (PDF)");
    });

    it("arquivo inválido mostra o erro do backend e não lista nada", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(enviarComprovanteProtocolo).mockRejectedValue(
        new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 400,
          data: { arquivo: ["Tipo de arquivo não permitido. Aceito: PDF."] },
        } as AxiosResponse),
      );
      const onAtualizado = vi.fn();
      renderComponente(true, vi.fn(), onAtualizado);
      await screen.findByLabelText("Número do protocolo");

      // fireEvent: o userEvent.upload descarta o arquivo fora do `accept`,
      // e o arquivo inválido chega por "Todos os arquivos" no seletor.
      fireEvent.change(
        screen.getByLabelText("Arquivo do comprovante de protocolo"),
        {
          target: {
            files: [new File(["x"], "protocolo.docx", { type: "application/msword" })],
          },
        },
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Tipo de arquivo não permitido. Aceito: PDF.",
        );
      });
      expect(onAtualizado).not.toHaveBeenCalled();
      expect(screen.queryByText("protocolo.docx")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Anexar comprovante" }),
      ).toBeEnabled();
    });

    it("'Concluir renovação' e 'Salvar protocolo' ficam desabilitados enquanto o comprovante sobe", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      vi.mocked(enviarComprovanteProtocolo).mockReturnValue(
        new Promise(() => {}),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await user.type(
        await screen.findByLabelText("Número do protocolo"),
        "2026/00184-LIC",
      );

      await user.upload(
        screen.getByLabelText("Arquivo do comprovante de protocolo"),
        new File(["%PDF"], "protocolo.pdf", { type: "application/pdf" }),
      );

      expect(
        await screen.findByRole("button", { name: "Enviando comprovante..." }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Salvar protocolo" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Concluir renovação" }),
      ).toBeDisabled();
    });
  });

  describe("comentários da renovação (STC-774)", () => {
    const CARD = { demanda: 36, status: "em_andamento" as const, comentarios_count: 1 };

    it("processo sem card não tem o botão Comentários", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([processo()]);
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      expect(
        screen.queryByRole("button", { name: /Comentários/ }),
      ).not.toBeInTheDocument();
    });

    it("abre os comentários do processo, comenta e volta ao formulário", async () => {
      vi.mocked(listarProcessosRenovacao).mockResolvedValue([
        processo({ card_kanban: CARD }),
      ]);
      vi.mocked(listarComentariosDaRenovacao).mockResolvedValue([
        { id: 1, usuario: USUARIO, texto: "Protocolo enviado.", created_at: "2026-06-03T13:30:00Z" },
      ]);
      vi.mocked(comentarNaRenovacao).mockResolvedValue({
        id: 2,
        usuario: USUARIO,
        texto: "Recebido.",
        created_at: "2026-06-03T14:00:00Z",
      });
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");

      const botao = screen.getByRole("button", { name: "Comentários, 1 comentário" });
      await user.click(botao);

      expect(
        await screen.findByRole("heading", { name: "Comentários · Alvará de Funcionamento" }),
      ).toBeInTheDocument();
      expect(await screen.findByText("Protocolo enviado.")).toBeInTheDocument();
      expect(listarComentariosDaRenovacao).toHaveBeenCalledWith(9);

      const chamadasAntes = vi.mocked(listarProcessosRenovacao).mock.calls.length;
      await user.type(
        screen.getByPlaceholderText("Adicionar comentário... (Enter para enviar)"),
        "Recebido.{Enter}",
      );
      await waitFor(() => {
        expect(comentarNaRenovacao).toHaveBeenCalledWith(9, "Recebido.");
      });
      // A contagem do botão vem da lista de processos: ela é atualizada.
      await waitFor(() => {
        expect(vi.mocked(listarProcessosRenovacao).mock.calls.length).toBeGreaterThan(
          chamadasAntes,
        );
      });

      await user.click(screen.getByRole("button", { name: "Voltar" }));
      expect(
        screen.queryByRole("heading", { name: /Comentários ·/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Número do protocolo")).toBeInTheDocument();
    });

    it("renovação concluída por outra pessoa com o painel aberto: o painel fecha sem travar o modal", async () => {
      vi.mocked(listarProcessosRenovacao)
        .mockResolvedValueOnce([processo({ card_kanban: CARD })])
        // Depois de comentar, a lista é recarregada: a renovação já foi
        // concluída por outra pessoa.
        .mockResolvedValue([
          processo({ status: "concluido", card_kanban: { ...CARD, status: "concluido" } }),
        ]);
      vi.mocked(listarComentariosDaRenovacao).mockResolvedValue([]);
      vi.mocked(comentarNaRenovacao).mockResolvedValue({
        id: 2,
        usuario: USUARIO,
        texto: "Última mensagem.",
        created_at: "2026-06-03T14:00:00Z",
      });
      vi.mocked(criarProcessoRenovacao).mockResolvedValue(
        processo({ id: 10, card_kanban: { ...CARD, comentarios_count: 0 } }),
      );
      const user = userEvent.setup();
      renderComponente(true);
      await screen.findByLabelText("Número do protocolo");
      await user.click(screen.getByRole("button", { name: "Comentários, 1 comentário" }));
      await screen.findByText("Nenhum comentário ainda.");

      await user.type(
        screen.getByPlaceholderText("Adicionar comentário... (Enter para enviar)"),
        "Última mensagem.{Enter}",
      );

      const iniciar = await screen.findByRole("button", {
        name: "Iniciar processo de renovação",
      });
      expect(screen.queryByRole("heading", { name: /Comentários ·/ })).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Processo de Renovação" }).closest("[inert]"),
      ).toBeNull();

      // Uma renovação nova não reabre o painel sozinha.
      await user.click(iniciar);
      expect(await screen.findByLabelText("Número do protocolo")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Comentários ·/ })).not.toBeInTheDocument();
    });
  });
});
