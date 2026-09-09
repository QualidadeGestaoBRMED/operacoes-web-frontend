import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import type {
  DocumentoUnidade,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { ProcessoRenovacaoModal } from "./ProcessoRenovacaoModal";

vi.mock("@/lib/legalizacao");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { criarProcessoRenovacao } from "@/lib/legalizacao";
import { toast } from "sonner";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
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
    status: "vencido",
    justificativa_excecao: "",
    validade: "2026-01-01",
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderComponente(
  aberto: boolean,
  onOpenChange: (open: boolean) => void = vi.fn(),
  onRegistrado: () => void = vi.fn(),
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProcessoRenovacaoModal
        documento={documento()}
        aberto={aberto}
        onOpenChange={onOpenChange}
        onRegistrado={onRegistrado}
      />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ProcessoRenovacaoModal (STC-380)", () => {
  it("não renderiza quando fechado", () => {
    renderComponente(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra o passo de confirmação com o contexto do documento", () => {
    renderComponente(true);

    expect(
      screen.getByRole("heading", { name: "Processo de Renovação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Alvará de Funcionamento · Niterói"),
    ).toBeInTheDocument();
    expect(criarProcessoRenovacao).not.toHaveBeenCalled();
  });

  it("Cancelar chama onOpenChange(false) sem criar nada", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, onOpenChange);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(criarProcessoRenovacao).not.toHaveBeenCalled();
  });

  it("Confirmar cria o processo, chama onRegistrado e mostra a Solicitação concluída", async () => {
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
      created_at: "2026-06-02T10:00:00Z",
    });
    const onRegistrado = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, vi.fn(), onRegistrado);

    await user.click(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    );

    await waitFor(() => {
      expect(criarProcessoRenovacao).toHaveBeenCalledWith({
        documento_unidade: 55,
      });
    });
    expect(onRegistrado).toHaveBeenCalled();
    expect(
      await screen.findByText(/solicitação · concluída/i),
    ).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "Processo de renovação iniciado.",
    );
    expect(
      screen.queryByRole("button", { name: "Iniciar processo de renovação" }),
    ).not.toBeInTheDocument();
  });

  it("mostra toast de erro e mantém o passo de confirmação quando a criação falha", async () => {
    vi.mocked(criarProcessoRenovacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    const onRegistrado = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, vi.fn(), onRegistrado);

    await user.click(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onRegistrado).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Iniciar processo de renovação" }),
    ).toBeInTheDocument();
  });
});
