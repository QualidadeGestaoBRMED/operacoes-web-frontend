import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import type {
  DocumentoUnidade,
  RegraDocumento,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { MovimentacaoProfissionalModal } from "./MovimentacaoProfissionalModal";

vi.mock("@/lib/legalizacao");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  listarDocumentosLegalizacao,
  reportarMovimentacaoProfissional,
} from "@/lib/legalizacao";
import { toast } from "sonner";

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
};

function tipo(
  overrides: Partial<TipoDocumentoRegulatorio>,
): TipoDocumentoRegulatorio {
  return {
    id: 1,
    codigo: "cnes",
    nome: "CNES",
    categoria: "registros_tecnicos",
    area_responsavel: "legalizacao",
    setor_apoio: "",
    exige_validade: false,
    exige_protocolo: false,
    exige_evidencia: false,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function regra(overrides: Partial<RegraDocumento> = {}): RegraDocumento {
  return {
    id: 1,
    tipo_documento: 1,
    unidade: 1,
    antecedencia_dias: 60,
    periodicidade_meses: null,
    janela_dia_inicio: null,
    janela_dia_fim: null,
    criticidade: "alta",
    vigente_a_partir: "2026-01-01",
    ativa: true,
    gera_card_demanda: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function doc(overrides: Partial<DocumentoUnidade>): DocumentoUnidade {
  return {
    id: 100,
    tipo_documento: tipo({}),
    unidade: UNIDADE,
    status: "regular",
    justificativa_excecao: "",
    validade: null,
    evidencia_vigente: null,
    regra_aplicada: null,
    responsaveis: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const CNES = doc({
  id: 10,
  tipo_documento: tipo({ id: 1, codigo: "cnes", nome: "CNES" }),
});
const CREMERJ = doc({
  id: 11,
  tipo_documento: tipo({
    id: 2,
    codigo: "registro-cremerj",
    nome: "Registro CREMERJ",
  }),
});
const DOSIMETRIA = doc({
  id: 12,
  tipo_documento: tipo({
    id: 3,
    codigo: "dosimetria",
    nome: "Controle de Dosimetria",
  }),
});
const ALVARA = doc({
  id: 13,
  tipo_documento: tipo({
    id: 4,
    codigo: "alvara-funcionamento",
    nome: "Alvará de Funcionamento",
  }),
});

function renderComponente(
  aberto = true,
  documentoAtual: DocumentoUnidade | null = CNES,
  onOpenChange: (open: boolean) => void = vi.fn(),
  onAtualizado: () => void = vi.fn(),
  onEntradaConcluida: () => void = vi.fn(),
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MovimentacaoProfissionalModal
        documento={documentoAtual}
        aberto={aberto}
        onOpenChange={onOpenChange}
        onAtualizado={onAtualizado}
        onEntradaConcluida={onEntradaConcluida}
      />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
    CNES,
    CREMERJ,
    DOSIMETRIA,
    ALVARA,
  ]);
});

async function preencherObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Profissional"), "Dr. João da Silva");
}

describe("MovimentacaoProfissionalModal (STC-382)", () => {
  it("mostra o toggle Saída/Entrada, com Saída ativo por padrão", async () => {
    renderComponente();

    expect(
      await screen.findByRole("heading", {
        name: /reportar movimentação profissional/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saída" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Entrada" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Confirmar saída" }),
    ).toBeInTheDocument();
  });

  it("clicar em Entrada troca o rótulo do botão e o texto do callout", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByRole("heading", {
      name: /reportar movimentação profissional/i,
    });

    await user.click(screen.getByRole("button", { name: "Entrada" }));

    expect(
      screen.getByRole("button", { name: "Confirmar entrada" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/em andamento/i)).toBeInTheDocument();
  });

  it("filtra fora documentos não regulados por movimentação de profissional (Alvará)", async () => {
    renderComponente();

    expect(await screen.findByText("CNES")).toBeInTheDocument();
    expect(screen.getByText("Registro CREMERJ")).toBeInTheDocument();
    expect(screen.getByText("Controle de Dosimetria")).toBeInTheDocument();
    expect(
      screen.queryByText("Alvará de Funcionamento"),
    ).not.toBeInTheDocument();
  });

  it("pré-marca conforme a Função padrão (Responsável Técnico Médico): CNES e CREMERJ, não Dosimetria", async () => {
    renderComponente();
    await screen.findByText("CNES");

    expect(screen.getByRole("checkbox", { name: /CNES/ })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
    ).not.toBeChecked();
  });

  it("trocar Função pra Técnico de Radiologia marca CNES e Dosimetria, desmarca CREMERJ", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByLabelText("Função"));
    await user.click(
      await screen.findByRole("option", { name: "Técnico de Radiologia" }),
    );

    expect(
      screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
    ).not.toBeChecked();
  });

  it("Confirmar fica desabilitado sem Profissional preenchido", async () => {
    renderComponente();
    await screen.findByText("CNES");

    expect(
      screen.getByRole("button", { name: "Confirmar saída" }),
    ).toBeDisabled();
  });

  it("Confirmar fica desabilitado sem nenhum documento marcado", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");
    await preencherObrigatorios(user);
    await user.click(screen.getByRole("checkbox", { name: /CNES/ }));
    await user.click(
      screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
    );

    expect(
      screen.getByRole("button", { name: "Confirmar saída" }),
    ).toBeDisabled();
  });

  describe("RN12 -- antecedência mínima do dosímetro", () => {
    it("bloqueia Confirmar quando Entrada com Dosimetria marcada tem data de hoje", async () => {
      const user = userEvent.setup();
      renderComponente();
      await screen.findByText("CNES");
      await preencherObrigatorios(user);
      await user.click(screen.getByRole("button", { name: "Entrada" }));
      // Só Dosimetria marcada, pra isolar a regra.
      await user.click(screen.getByRole("checkbox", { name: /CNES/ }));
      await user.click(
        screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
      );
      await user.click(
        screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
      );

      expect(
        screen.getByText(/exige data com pelo menos 30 dias de antecedência/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Confirmar entrada" }),
      ).toBeDisabled();
    });

    it("não bloqueia Saída com Dosimetria marcada, mesmo com data de hoje (RN12 só vale pra Entrada)", async () => {
      const user = userEvent.setup();
      renderComponente();
      await screen.findByText("CNES");
      await preencherObrigatorios(user);
      await user.click(
        screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
      );

      expect(
        screen.queryByText(/exige data com pelo menos/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Confirmar saída" }),
      ).toBeEnabled();
    });
  });

  describe("RN13 -- janela do CNES", () => {
    it("mostra os dias configurados na regra quando marcar CNES", async () => {
      vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
        {
          ...CNES,
          regra_aplicada: regra({ janela_dia_inicio: 10, janela_dia_fim: 24 }),
        },
        CREMERJ,
        DOSIMETRIA,
      ]);
      renderComponente();

      expect(await screen.findByText(/entre os dias/i)).toBeInTheDocument();
      expect(screen.getByText("10 e 24")).toBeInTheDocument();
    });

    it("mostra aviso genérico quando a regra do CNES não tem janela configurada", async () => {
      renderComponente();
      await screen.findByText("CNES");

      expect(
        screen.getByText(/janela operacional restrita/i),
      ).toBeInTheDocument();
    });

    it("não mostra nenhum aviso de janela quando CNES não está marcado", async () => {
      const user = userEvent.setup();
      renderComponente();
      await screen.findByText("CNES");

      await user.click(screen.getByRole("checkbox", { name: /CNES/ }));

      expect(screen.queryByText(/RN13/)).not.toBeInTheDocument();
    });
  });

  it("Confirmar dispara uma chamada por documento marcado e fecha o modal em sucesso total", async () => {
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => ({ ...CNES, id }),
    );
    const onOpenChange = vi.fn();
    const onAtualizado = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, CNES, onOpenChange, onAtualizado);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

    await waitFor(() => {
      expect(reportarMovimentacaoProfissional).toHaveBeenCalledTimes(2);
    });
    expect(reportarMovimentacaoProfissional).toHaveBeenCalledWith(10, {
      tipo: "saida",
      profissional: "Dr. João da Silva",
      data: expect.any(String),
    });
    expect(reportarMovimentacaoProfissional).toHaveBeenCalledWith(11, {
      tipo: "saida",
      profissional: "Dr. João da Silva",
      data: expect.any(String),
    });
    expect(onAtualizado).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("Saída reportada.");
  });

  describe("encadeamento com o Acompanhar Renovação (STC-382/STC-431)", () => {
    it("Entrada com sucesso total, com o documento de origem marcado, chama onEntradaConcluida", async () => {
      vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
        async (id) => ({ ...CNES, id }),
      );
      const onEntradaConcluida = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, CNES, vi.fn(), vi.fn(), onEntradaConcluida);
      await screen.findByText("CNES");
      await preencherObrigatorios(user);
      await user.click(screen.getByRole("button", { name: "Entrada" }));

      await user.click(
        screen.getByRole("button", { name: "Confirmar entrada" }),
      );

      await waitFor(() => {
        expect(onEntradaConcluida).toHaveBeenCalled();
      });
    });

    it("Saída com sucesso total NÃO chama onEntradaConcluida", async () => {
      vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
        async (id) => ({ ...CNES, id }),
      );
      const onEntradaConcluida = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, CNES, vi.fn(), vi.fn(), onEntradaConcluida);
      await screen.findByText("CNES");
      await preencherObrigatorios(user);

      await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

      await waitFor(() => {
        expect(reportarMovimentacaoProfissional).toHaveBeenCalled();
      });
      expect(onEntradaConcluida).not.toHaveBeenCalled();
    });

    it("Entrada com sucesso total, mas com o documento de origem desmarcado, NÃO chama onEntradaConcluida", async () => {
      vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
        async (id) => ({ ...CNES, id }),
      );
      const onEntradaConcluida = vi.fn();
      const user = userEvent.setup();
      renderComponente(true, CNES, vi.fn(), vi.fn(), onEntradaConcluida);
      await screen.findByText("CNES");
      await preencherObrigatorios(user);
      await user.click(screen.getByRole("button", { name: "Entrada" }));
      // Desmarca o CNES (documento de origem, prop `documento`), mantém só o CREMERJ.
      await user.click(screen.getByRole("checkbox", { name: /CNES/ }));

      await user.click(
        screen.getByRole("button", { name: "Confirmar entrada" }),
      );

      await waitFor(() => {
        expect(reportarMovimentacaoProfissional).toHaveBeenCalled();
      });
      expect(onEntradaConcluida).not.toHaveBeenCalled();
    });
  });

  it("mostra erro (não lista vazia) quando a busca de documentos afetados falha", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockRejectedValue(
      new Error("Falha de rede."),
    );
    renderComponente();

    expect(
      await screen.findByText(
        /não foi possível carregar os documentos desta unidade/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nenhum documento regulado/i),
    ).not.toBeInTheDocument();
  });

  it("sucesso parcial: erro aparece só no documento que falhou, o outro fica confirmado, modal não fecha", async () => {
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => {
        if (id === 11) throw new Error("Falha de rede.");
        return { ...CNES, id };
      },
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, CNES, onOpenChange);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    const linhaCremerj = screen
      .getByText("Registro CREMERJ")
      .closest("div")!.parentElement!;
    expect(
      within(linhaCremerj).getByText(/não foi possível/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("CNES").closest("div")!.parentElement!).getByText(
        "Confirmado",
      ),
    ).toBeInTheDocument();
  });

  it("depois de uma tentativa parcial, trava Tipo/Profissional/Função/Data -- retry não pode virar um evento diferente do original", async () => {
    // Achado em análise de falhas críticas: sem travar esses campos, dava
    // pra trocar Saída/Entrada (ou o profissional, ou a data) entre a
    // tentativa original e um "Tentar novamente", fazendo dois documentos
    // que deveriam representar o MESMO evento ficarem com históricos
    // contraditórios entre si.
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => {
        if (id === 11) throw new Error("Falha de rede.");
        return { ...CNES, id };
      },
    );
    const user = userEvent.setup();
    renderComponente(true, CNES);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: "Saída" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Entrada" })).toBeDisabled();
    expect(screen.getByLabelText("Profissional")).toBeDisabled();
    expect(screen.getByLabelText("Função")).toBeDisabled();
    expect(screen.getByLabelText(/data da movimentação/i)).toBeDisabled();
  });

  it("desmarcar um documento que falhou remove o erro exibido pra ele", async () => {
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => {
        if (id === 11) throw new Error("Falha de rede.");
        return { ...CNES, id };
      },
    );
    const user = userEvent.setup();
    renderComponente(true, CNES);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(screen.getByText(/não foi possível/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
    );

    expect(screen.queryByText(/não foi possível/i)).not.toBeInTheDocument();
  });

  it("um novo clique em 'Tentar novamente' reenvia só o documento que falhou, não o já confirmado", async () => {
    vi.mocked(reportarMovimentacaoProfissional)
      .mockImplementationOnce(async (id) => ({ ...CNES, id })) // CNES (10), 1ª tentativa
      .mockImplementationOnce(async () => {
        throw new Error("Falha de rede.");
      }) // CREMERJ (11), 1ª tentativa
      .mockImplementationOnce(async (id) => ({ ...CNES, id })); // CREMERJ (11), retry
    const user = userEvent.setup();
    renderComponente(true, CNES);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));
    await waitFor(() => {
      expect(reportarMovimentacaoProfissional).toHaveBeenCalledTimes(2);
    });

    await user.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );

    await waitFor(() => {
      expect(reportarMovimentacaoProfissional).toHaveBeenCalledTimes(3);
    });
    expect(reportarMovimentacaoProfissional).toHaveBeenLastCalledWith(
      11,
      expect.objectContaining({ tipo: "saida" }),
    );
  });
});
