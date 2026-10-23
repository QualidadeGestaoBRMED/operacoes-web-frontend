import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import type {
  DocumentoUnidade,
  ItemDoLote,
  LoteRenovacao,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { LoteRenovacaoModal } from "./LoteRenovacaoModal";

vi.mock("@/lib/legalizacao");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { usuarioId: 7 }, perfil: null, isLoading: false }),
}));

import {
  buscarLote,
  concluirLote,
  enviarCertificadoUnicoLote,
  enviarComprovanteLote,
  enviarEvidenciaLegalizacao,
  iniciarLote,
  listarDocumentosLegalizacao,
  registrarProtocoloLote,
  retirarItemLote,
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

const TIPO: TipoDocumentoRegulatorio = {
  id: 4,
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

function documento(overrides: Partial<DocumentoUnidade> = {}): DocumentoUnidade {
  return {
    id: 10,
    tipo_documento: TIPO,
    unidade: UNIDADE,
    status: "vencido",
    justificativa_excecao: "",
    validade: "2026-01-01",
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    profissional: "BALANÇA 01",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function item(id: number, identificador: string, overrides: Partial<ItemDoLote> = {}): ItemDoLote {
  return {
    id,
    documento: { id: id + 100, identificador, status: "em_andamento", validade: "2026-01-01" },
    status: "em_andamento",
    data_conclusao: null,
    tem_certificado: false,
    ...overrides,
  };
}

function lote(overrides: Partial<LoteRenovacao> = {}): LoteRenovacao {
  return {
    id: 5,
    tipo_documento: { id: TIPO.id, nome: TIPO.nome },
    unidade: { id: UNIDADE.id, nome: UNIDADE.nome },
    data_solicitacao: null,
    usuario_responsavel: null,
    protocolo_numero: "",
    protocolo_orgao: "",
    protocolo_data: null,
    observacoes: "",
    concluido_em: null,
    itens: [item(1, "BALANÇA 01"), item(2, "BALANÇA 02")],
    progresso: { concluidos: 0, total: 2 },
    card_kanban: { demanda: 40, status: "em_andamento" },
    created_at: "2026-10-20T13:00:00Z",
    ...overrides,
  };
}

function erroDaApi(mensagem: string) {
  return new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    data: { lote: mensagem },
  } as AxiosResponse);
}

function renderComponente(props: {
  loteId?: number | null;
  documentoInicial?: DocumentoUnidade | null;
}) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <LoteRenovacaoModal
        aberto
        onOpenChange={vi.fn()}
        loteId={props.loteId ?? null}
        documentoInicial={props.documentoInicial}
      />
    </SWRConfig>,
  );
}

function pdf(nome = "laudo.pdf") {
  return new File(["%PDF"], nome, { type: "application/pdf" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("LoteRenovacaoModal (STC-779)", () => {
  describe("escolha das instâncias", () => {
    beforeEach(() => {
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        documento(),
        documento({ id: 11, profissional: "BALANÇA 02", status: "regular" }),
        documento({ id: 12, profissional: "BALANÇA 03", status: "em_andamento" }),
      ]);
    });

    it("lista as instâncias do tipo na clínica, com a aberta marcada e a em renovação de fora", async () => {
      renderComponente({ documentoInicial: documento() });

      const lista = await screen.findByRole("list", { name: "Instâncias" });
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({
        unidade: 1,
        tipo_documento: 4,
      });
      expect(within(lista).getByRole("checkbox", { name: /BALANÇA 01/ })).toBeChecked();
      expect(within(lista).getByRole("checkbox", { name: /BALANÇA 02/ })).not.toBeChecked();
      expect(within(lista).getByRole("checkbox", { name: /BALANÇA 03/ })).toBeDisabled();
      expect(within(lista).getByText("em renovação")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Iniciar lote com 1 itens" }),
      ).toBeDisabled();
    });

    it("lista vazia diz que não há instâncias", async () => {
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
      renderComponente({ documentoInicial: documento() });

      expect(
        await screen.findByText("Nenhuma instância deste tipo nesta clínica."),
      ).toBeInTheDocument();
    });

    it("falha ao listar oferece tentar de novo", async () => {
      vi.mocked(listarDocumentosLegalizacao)
        .mockRejectedValueOnce(erroDaApi("Falha ao listar."))
        .mockResolvedValue([documento()]);
      const user = userEvent.setup();
      renderComponente({ documentoInicial: documento() });

      await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

      expect(await screen.findByRole("list", { name: "Instâncias" })).toBeInTheDocument();
    });

    it("inicia o lote com as marcadas e passa para o lote", async () => {
      vi.mocked(iniciarLote).mockResolvedValue(lote());
      vi.mocked(buscarLote).mockResolvedValue(lote());
      const user = userEvent.setup();
      renderComponente({ documentoInicial: documento() });
      const lista = await screen.findByRole("list", { name: "Instâncias" });

      await user.click(within(lista).getAllByRole("checkbox")[1]);
      await user.type(screen.getByLabelText("Data da solicitação"), "2026-10-20");
      await user.click(screen.getByRole("button", { name: "Iniciar lote com 2 itens" }));

      expect(iniciarLote).toHaveBeenCalledWith({
        documentos: [10, 11],
        data_solicitacao: "2026-10-20",
        usuario_responsavel: 7,
      });
      expect(await screen.findByRole("list", { name: "Itens do lote" })).toBeInTheDocument();
      expect(screen.getByText("0 de 2 concluídos")).toBeInTheDocument();
    });

    it("fechado por fora e reaberto, volta à escolha em vez do lote criado", async () => {
      vi.mocked(iniciarLote).mockResolvedValue(lote());
      vi.mocked(buscarLote).mockResolvedValue(lote());
      const user = userEvent.setup();
      const montar = (aberto: boolean) => (
        <SWRConfig value={{ provider: () => new Map() }}>
          <LoteRenovacaoModal
            aberto={aberto}
            onOpenChange={vi.fn()}
            loteId={null}
            documentoInicial={documento()}
          />
        </SWRConfig>
      );
      const { rerender } = render(montar(true));
      const lista = await screen.findByRole("list", { name: "Instâncias" });
      await user.click(within(lista).getAllByRole("checkbox")[1]);
      await user.click(screen.getByRole("button", { name: "Iniciar lote com 2 itens" }));
      await screen.findByRole("list", { name: "Itens do lote" });

      rerender(montar(false));
      rerender(montar(true));

      expect(await screen.findByRole("list", { name: "Instâncias" })).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Itens do lote" })).not.toBeInTheDocument();
    });

    it("instância marcada que entra em renovação depois não conta nem vai no pedido", async () => {
      vi.mocked(listarDocumentosLegalizacao)
        .mockResolvedValueOnce([
          documento(),
          documento({ id: 11, profissional: "BALANÇA 02", status: "regular" }),
          documento({ id: 12, profissional: "BALANÇA 03", status: "regular" }),
        ])
        .mockResolvedValue([
          documento(),
          documento({ id: 11, profissional: "BALANÇA 02", status: "em_andamento" }),
          documento({ id: 12, profissional: "BALANÇA 03", status: "regular" }),
        ]);
      vi.mocked(iniciarLote).mockResolvedValue(lote());
      vi.mocked(buscarLote).mockResolvedValue(lote());
      const user = userEvent.setup();
      // Sem o intervalo de dedupe e de foco do SWR: a releitura por foco logo
      // depois da primeira busca seria descartada.
      render(
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0 }}
        >
          <LoteRenovacaoModal
            aberto
            onOpenChange={vi.fn()}
            loteId={null}
            documentoInicial={documento()}
          />
        </SWRConfig>,
      );
      const lista = await screen.findByRole("list", { name: "Instâncias" });
      await user.click(within(lista).getByRole("checkbox", { name: /BALANÇA 02/ }));
      await user.click(within(lista).getByRole("checkbox", { name: /BALANÇA 03/ }));
      expect(screen.getByRole("button", { name: "Iniciar lote com 3 itens" })).toBeEnabled();

      // A lista é relida (ex.: a janela volta a ter foco) e a BALANÇA 02 já
      // está em renovação por outra pessoa.
      window.dispatchEvent(new Event("focus"));
      await waitFor(() =>
        expect(within(lista).getByRole("checkbox", { name: /BALANÇA 02/ })).toBeDisabled(),
      );
      await user.click(screen.getByRole("button", { name: "Iniciar lote com 2 itens" }));

      expect(iniciarLote).toHaveBeenCalledWith(
        expect.objectContaining({ documentos: [10, 12] }),
      );
    });

    it("erro da API mostra a mensagem e mantém a seleção", async () => {
      vi.mocked(iniciarLote).mockRejectedValue(erroDaApi("Já têm renovação em andamento: BALANÇA 02."));
      const user = userEvent.setup();
      renderComponente({ documentoInicial: documento() });
      const lista = await screen.findByRole("list", { name: "Instâncias" });
      await user.click(within(lista).getAllByRole("checkbox")[1]);

      await user.click(screen.getByRole("button", { name: "Iniciar lote com 2 itens" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Já têm renovação em andamento: BALANÇA 02.");
      });
      expect(within(lista).getAllByRole("checkbox")[1]).toBeChecked();
      expect(screen.getByRole("button", { name: "Iniciar lote com 2 itens" })).toBeEnabled();
    });
  });

  describe("lote existente", () => {
    it("protocolo e comprovante uma vez para o lote", async () => {
      vi.mocked(buscarLote).mockResolvedValue(lote());
      vi.mocked(registrarProtocoloLote).mockResolvedValue(lote({ protocolo_numero: "2026/9" }));
      vi.mocked(enviarComprovanteLote).mockResolvedValue(lote());
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });

      await user.type(await screen.findByLabelText("Número do protocolo"), "2026/9");
      await user.click(screen.getByRole("button", { name: "Salvar protocolo" }));
      const arquivo = pdf("protocolo.pdf");
      await user.upload(
        screen.getByLabelText("Arquivo do comprovante de protocolo do lote"),
        arquivo,
      );

      expect(registrarProtocoloLote).toHaveBeenCalledWith(5, {
        protocolo_numero: "2026/9",
        protocolo_orgao: "",
        protocolo_data: null,
        observacoes: "",
      });
      await waitFor(() => expect(enviarComprovanteLote).toHaveBeenCalledWith(5, arquivo));
      expect(await screen.findByText("Anexado: protocolo.pdf")).toBeInTheDocument();
    });

    it("um PDF para todos", async () => {
      vi.mocked(buscarLote).mockResolvedValue(lote());
      vi.mocked(enviarCertificadoUnicoLote).mockResolvedValue(
        lote({ itens: [item(1, "BALANÇA 01", { tem_certificado: true }), item(2, "BALANÇA 02", { tem_certificado: true })] }),
      );
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await screen.findByRole("list", { name: "Itens do lote" });
      const arquivo = pdf();

      await user.upload(screen.getByLabelText("Arquivo do PDF único do lote"), arquivo);

      await waitFor(() => expect(enviarCertificadoUnicoLote).toHaveBeenCalledWith(5, arquivo));
      expect(await screen.findByLabelText("Com certificado: BALANÇA 01")).toBeInTheDocument();
    });

    it("um PDF por item sobe pela rota de evidência do documento", async () => {
      vi.mocked(buscarLote).mockResolvedValue(lote());
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await screen.findByRole("list", { name: "Itens do lote" });

      await user.click(screen.getByLabelText("Um PDF por item"));
      const arquivo = pdf("cert-02.pdf");
      await user.upload(screen.getByLabelText("Certificado de BALANÇA 02"), arquivo);

      await waitFor(() => expect(enviarEvidenciaLegalizacao).toHaveBeenCalledWith(102, arquivo));
      expect(screen.queryByLabelText("Arquivo do PDF único do lote")).not.toBeInTheDocument();
      // O lote é relido para mostrar o certificado novo.
      await waitFor(() => expect(vi.mocked(buscarLote).mock.calls.length).toBeGreaterThan(1));
      expect(toast.success).toHaveBeenCalledWith("Certificado de BALANÇA 02 anexado.");
    });

    it("PDF por item enviado e releitura do lote falhando não vira erro de envio", async () => {
      vi.mocked(buscarLote)
        .mockResolvedValueOnce(lote())
        .mockRejectedValue(new Error("Falha de rede."));
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await screen.findByRole("list", { name: "Itens do lote" });
      await user.click(screen.getByLabelText("Um PDF por item"));

      await user.upload(screen.getByLabelText("Certificado de BALANÇA 01"), pdf());

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Certificado de BALANÇA 01 anexado."),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("sem certificado não conclui e diz quem falta", async () => {
      vi.mocked(buscarLote).mockResolvedValue(
        lote({ itens: [item(1, "BALANÇA 01", { tem_certificado: true }), item(2, "BALANÇA 02")] }),
      );
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await user.type(await screen.findByLabelText("Nova validade (para todos)"), "2027-01-01");

      expect(screen.getByRole("status")).toHaveTextContent("Falta certificado: BALANÇA 02.");
      expect(screen.getByRole("button", { name: "Concluir 2 itens" })).toBeDisabled();

      await user.click(screen.getByRole("checkbox", { name: "Concluir BALANÇA 02" }));

      expect(screen.getByRole("button", { name: "Concluir 1 item" })).toBeEnabled();
    });

    it("conclui com a validade comum e a ajustada por item; erro mantém o que foi preenchido", async () => {
      const comCertificado = lote({
        itens: [
          item(1, "BALANÇA 01", { tem_certificado: true }),
          item(2, "BALANÇA 02", { tem_certificado: true }),
        ],
      });
      vi.mocked(buscarLote).mockResolvedValue(comCertificado);
      vi.mocked(concluirLote)
        .mockRejectedValueOnce(erroDaApi("Falta o certificado de: BALANÇA 02."))
        .mockResolvedValueOnce({ ...comCertificado, concluido_em: "2026-10-20T15:00:00Z" });
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await user.type(await screen.findByLabelText("Nova validade (para todos)"), "2027-01-01");
      await user.type(screen.getByLabelText("Validade de BALANÇA 02"), "2027-06-15");

      await user.click(screen.getByRole("button", { name: "Concluir 2 itens" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Falta o certificado de: BALANÇA 02."),
      );
      expect(screen.getByLabelText("Nova validade (para todos)")).toHaveValue("2027-01-01");
      expect(screen.getByLabelText("Nova validade (para todos)")).toHaveAccessibleDescription(
        "Data em que o documento vence.",
      );
      expect(screen.getByLabelText("Validade de BALANÇA 02")).toHaveValue("2027-06-15");

      await user.click(screen.getByRole("button", { name: "Concluir 2 itens" }));

      expect(concluirLote).toHaveBeenLastCalledWith(5, [
        { processo: 1, nova_validade: "2027-01-01" },
        { processo: 2, nova_validade: "2027-06-15" },
      ]);
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Renovação em lote concluída."),
      );
    });

    it("protocolo digitado e não salvo vai junto ao concluir", async () => {
      const comCertificado = lote({
        itens: [
          item(1, "BALANÇA 01", { tem_certificado: true }),
          item(2, "BALANÇA 02", { tem_certificado: true }),
        ],
      });
      vi.mocked(buscarLote).mockResolvedValue(comCertificado);
      vi.mocked(registrarProtocoloLote).mockResolvedValue({
        ...comCertificado,
        protocolo_numero: "2026/9",
      });
      vi.mocked(concluirLote).mockResolvedValue(comCertificado);
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await user.type(await screen.findByLabelText("Número do protocolo"), "2026/9");
      await user.type(screen.getByLabelText("Nova validade (para todos)"), "2027-01-01");

      await user.click(screen.getByRole("button", { name: "Concluir 2 itens" }));

      await waitFor(() => expect(concluirLote).toHaveBeenCalled());
      expect(registrarProtocoloLote).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ protocolo_numero: "2026/9" }),
      );
      expect(vi.mocked(registrarProtocoloLote).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(concluirLote).mock.invocationCallOrder[0],
      );
    });

    it("protocolo alterado sem número não deixa concluir e diz por quê", async () => {
      vi.mocked(buscarLote).mockResolvedValue(
        lote({
          itens: [
            item(1, "BALANÇA 01", { tem_certificado: true }),
            item(2, "BALANÇA 02", { tem_certificado: true }),
          ],
        }),
      );
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await user.type(await screen.findByLabelText("Órgão"), "INMETRO");
      await user.type(screen.getByLabelText("Nova validade (para todos)"), "2027-01-01");

      expect(screen.getByRole("status")).toHaveTextContent(
        "Informe o número do protocolo ou apague os dados dele para concluir.",
      );
      expect(screen.getByRole("button", { name: "Concluir 2 itens" })).toBeDisabled();
    });

    it("retira um item seguindo com a renovação à parte", async () => {
      vi.mocked(buscarLote).mockResolvedValue(lote());
      vi.mocked(retirarItemLote).mockResolvedValue(
        lote({ itens: [item(2, "BALANÇA 02")], progresso: { concluidos: 0, total: 1 } }),
      );
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await screen.findByRole("list", { name: "Itens do lote" });

      await user.click(screen.getByRole("button", { name: "Retirar BALANÇA 01 do lote" }));
      await user.click(screen.getByRole("menuitem", { name: "Seguir com renovação à parte" }));

      expect(retirarItemLote).toHaveBeenCalledWith(5, 1, true);
      expect(await screen.findByText("0 de 1 concluídos")).toBeInTheDocument();
    });

    it("item com certificado não sai sem renovação", async () => {
      vi.mocked(buscarLote).mockResolvedValue(
        lote({ itens: [item(1, "BALANÇA 01", { tem_certificado: true }), item(2, "BALANÇA 02")] }),
      );
      const user = userEvent.setup();
      renderComponente({ loteId: 5 });
      await screen.findByRole("list", { name: "Itens do lote" });

      await user.click(screen.getByRole("button", { name: "Retirar BALANÇA 01 do lote" }));

      expect(
        screen.getByRole("menuitem", { name: "Sem renovação (já tem certificado)" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("lote que não existe mais mostra o aviso", async () => {
      vi.mocked(buscarLote).mockRejectedValue(
        new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 404,
          data: { detail: "Não encontrado." },
        } as AxiosResponse),
      );
      renderComponente({ loteId: 99 });

      expect(await screen.findByText("Não encontrado.")).toBeInTheDocument();
    });
  });
});
