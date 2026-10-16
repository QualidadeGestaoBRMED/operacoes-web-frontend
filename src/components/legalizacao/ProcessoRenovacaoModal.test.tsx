import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade, Usuario } from "@/types";
import type {
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
  criarProcessoRenovacao,
  enviarEvidenciaLegalizacao,
  listarProcessosRenovacao,
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
    created_at: "2026-06-02T10:00:00Z",
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

      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

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
      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
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
      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
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
      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
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
      const inputArquivo = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
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
});
