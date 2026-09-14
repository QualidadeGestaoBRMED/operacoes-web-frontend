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
    controlado_por_profissional: false,
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
    profissional: "",
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
    controlado_por_profissional: true,
  }),
  profissional: "Dr. João",
});
const DOSIMETRIA_2 = doc({
  id: 14,
  tipo_documento: tipo({
    id: 3,
    codigo: "dosimetria",
    nome: "Controle de Dosimetria",
    controlado_por_profissional: true,
  }),
  profissional: "Dra. Maria",
});
const ALVARA = doc({
  id: 13,
  tipo_documento: tipo({
    id: 4,
    codigo: "alvara-funcionamento",
    nome: "Alvará de Funcionamento",
  }),
});
const COREN_VENCIDO = doc({
  id: 15,
  status: "vencido",
  tipo_documento: tipo({ id: 5, codigo: "registro-coren", nome: "Registro COREN" }),
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

  it("grupo Tipo de movimentação tem nome acessível associado ao Label (role=group + aria-labelledby)", async () => {
    renderComponente();
    await screen.findByRole("heading", {
      name: /reportar movimentação profissional/i,
    });

    expect(
      screen.getByRole("group", { name: "Tipo de movimentação" }),
    ).toBeInTheDocument();
  });

  it("ícone, toggle, callout e botão derivam de uma única CSS custom property --mode-color, que muda junto ao trocar de tipo", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByRole("heading", {
      name: /reportar movimentação profissional/i,
    });

    const raiz = screen.getByRole("dialog");
    expect(raiz.style.getPropertyValue("--mode-color")).toContain("red-600");

    await user.click(screen.getByRole("button", { name: "Entrada" }));

    expect(raiz.style.getPropertyValue("--mode-color")).toContain("cyan-700");
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
    // Dosimetria mostra o profissional junto (STC-432) -- não é mais um nó
    // de texto exato "Controle de Dosimetria" sozinho.
    expect(
      screen.getByText(/Controle de Dosimetria — Dr\. João/),
    ).toBeInTheDocument();
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

  it("trocar Função pra Técnico de Radiologia marca CNES, desmarca CREMERJ -- Dosimetria fica de fora da sugestão (STC-432)", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByLabelText("Função"));
    await user.click(
      await screen.findByRole("option", { name: "Técnico de Radiologia" }),
    );

    // Dosimetria é controlado_por_profissional -- com mais de um documento
    // do mesmo tipo na unidade (um por profissional), a sugestão automática
    // não tem como saber qual é o certo, então nunca pré-marca; exige
    // escolha manual sempre (ver alternarMarcado/pré-seleção).
    expect(
      screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^CNES/ })).toBeChecked();
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

    it("o aviso de RN12 é anunciado (role=alert) e ligado ao campo Data via aria-describedby", async () => {
      // Achado no code review automático (PR #37): erros/avisos dinâmicos
      // não eram anunciados pra leitor de tela.
      const user = userEvent.setup();
      renderComponente();
      await screen.findByText("CNES");
      await preencherObrigatorios(user);
      await user.click(screen.getByRole("button", { name: "Entrada" }));
      await user.click(
        screen.getByRole("checkbox", { name: /Controle de Dosimetria/ }),
      );

      const aviso = screen.getByRole("alert");
      expect(aviso).toHaveTextContent(/RN12/);
      expect(screen.getByLabelText(/data da movimentação/i)).toHaveAttribute(
        "aria-describedby",
        aviso.id,
      );
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

    it("o aviso do CNES é anunciado (role=status, não interrompe como alert) e ligado ao checkbox do CNES via aria-describedby", async () => {
      renderComponente();
      await screen.findByText("CNES");

      const aviso = screen.getByRole("status");
      expect(aviso).toHaveTextContent(/RN13/);
      expect(screen.getByRole("checkbox", { name: /CNES/ })).toHaveAttribute(
        "aria-describedby",
        aviso.id,
      );
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

  it("Escape durante o envio não fecha o modal -- só fecha quando o envio realmente terminar", async () => {
    // Achado no code review automático (PR #37): o componente nunca
    // desmonta entre aberturas (o pai sempre o renderiza, só troca
    // `aberto`), então fechar no meio de um envio (Escape, clique no
    // overlay, "X") deixava a Promise.allSettled em curso resolver depois,
    // sobrescrevendo o estado já resetado e podendo até disparar
    // onEntradaConcluida() sozinha, sem nenhuma interação do usuário.
    let resolverEnvio: (valor: DocumentoUnidade) => void = () => {};
    vi.mocked(reportarMovimentacaoProfissional).mockReturnValue(
      new Promise<DocumentoUnidade>((resolve) => {
        resolverEnvio = resolve;
      }),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderComponente(true, CNES, onOpenChange);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));
    await waitFor(() => {
      expect(reportarMovimentacaoProfissional).toHaveBeenCalled();
    });

    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    resolverEnvio({ ...CNES, id: 10 });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
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

    // Achado no code review automático (PR #37): o erro por documento
    // precisa ser anunciado (role=alert) e ligado ao checkbox correspondente
    // via aria-describedby, não só visível na tela. Escopo mais estreito
    // aqui (só a linha do CREMERJ, não a lista inteira) pra pegar o
    // checkbox certo.
    const linhaCremerjEstreita = screen
      .getByText("Registro CREMERJ")
      .closest("div")!;
    const erroCremerj = within(linhaCremerjEstreita).getByRole("alert");
    expect(erroCremerj).toHaveTextContent(/não foi possível/i);
    expect(within(linhaCremerjEstreita).getByRole("checkbox")).toHaveAttribute(
      "aria-describedby",
      erroCremerj.id,
    );
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

  it("desmarcar o único documento que falhou desabilita o Confirmar, em vez de virar um clique sem efeito", async () => {
    // Achado no code review automático (PR #37): depois de um sucesso
    // parcial, desmarcar o documento que falhou (a forma de desistir do
    // retry) fazia `marcados` sobrar só com ids já confirmados. O rótulo
    // do botão voltava de "Tentar novamente" pra "Confirmar ...", parecendo
    // acionável, mas idsParaEnviar ficava vazio -- clique virava no-op
    // silencioso (sem chamada, sem toast, sem fechar).
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

    await user.click(
      screen.getByRole("checkbox", { name: /Registro CREMERJ/ }),
    );

    expect(
      screen.getByRole("button", { name: "Confirmar saída" }),
    ).toBeDisabled();

    vi.mocked(reportarMovimentacaoProfissional).mockClear();
    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

    expect(reportarMovimentacaoProfissional).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
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

describe("MovimentacaoProfissionalModal -- documento já Vencido (STC-437)", () => {
  beforeEach(() => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      CNES,
      COREN_VENCIDO,
    ]);
  });

  it("'Saída' não oferece documento já Vencido pra marcar", async () => {
    renderComponente();
    await screen.findByText("CNES");

    expect(
      screen.queryByRole("checkbox", { name: /Registro COREN/ }),
    ).not.toBeInTheDocument();
  });

  it("'Entrada' continua oferecendo documento Vencido normalmente", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByRole("button", { name: "Entrada" }));

    expect(
      screen.getByRole("checkbox", { name: /Registro COREN/ }),
    ).toBeInTheDocument();
  });

  it("trocar de 'Entrada' pra 'Saída' desmarca um documento Vencido que já estava marcado", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByRole("button", { name: "Entrada" }));
    await user.click(screen.getByRole("checkbox", { name: /Registro COREN/ }));
    expect(
      screen.getByRole("checkbox", { name: /Registro COREN/ }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Saída" }));

    // O documento nem aparece mais na lista (filtrado) -- confirma que o
    // id também saiu de `marcados`, não só escondido da tela, marcando
    // "Entrada" de novo e conferindo que o checkbox voltou desmarcado.
    await user.click(screen.getByRole("button", { name: "Entrada" }));
    expect(
      screen.getByRole("checkbox", { name: /Registro COREN/ }),
    ).not.toBeChecked();
  });
});

describe("MovimentacaoProfissionalModal -- tipos controlado_por_profissional (STC-432)", () => {
  beforeEach(() => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      CNES,
      DOSIMETRIA,
      DOSIMETRIA_2,
    ]);
  });

  it("marcar um segundo documento controlado por profissional desmarca o primeiro", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(
      screen.getByRole("checkbox", { name: /Dr\. João/ }),
    );
    expect(
      screen.getByRole("checkbox", { name: /Dr\. João/ }),
    ).toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: /Dra\. Maria/ }),
    );

    expect(
      screen.getByRole("checkbox", { name: /Dr\. João/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Dra\. Maria/ }),
    ).toBeChecked();
  });

  it("'Saída' com um documento controlado marcado trava Profissional no nome já associado a ele", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByRole("checkbox", { name: /Dr\. João/ }));

    const campoProfissional = screen.getByLabelText("Profissional");
    expect(campoProfissional).toHaveValue("Dr. João");
    expect(campoProfissional).toBeDisabled();
  });

  it("'Entrada' com um documento controlado marcado deixa Profissional livre pra cadastrar alguém novo", async () => {
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByRole("button", { name: "Entrada" }));
    await user.click(screen.getByRole("checkbox", { name: /Dr\. João/ }));

    const campoProfissional = screen.getByLabelText("Profissional");
    expect(campoProfissional).not.toBeDisabled();
    await user.type(campoProfissional, "Dr. João Substituto");
    expect(campoProfissional).toHaveValue("Dr. João Substituto");
  });

  it("envia o profissional travado do documento marcado, não o que estiver no estado interno do campo", async () => {
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => ({ ...DOSIMETRIA, id }),
    );
    const user = userEvent.setup();
    renderComponente();
    await screen.findByText("CNES");

    await user.click(screen.getByRole("checkbox", { name: /Dr\. João/ }));
    await user.click(
      screen.getByRole("button", { name: "Confirmar saída" }),
    );

    await waitFor(() => {
      expect(reportarMovimentacaoProfissional).toHaveBeenCalledWith(12, {
        tipo: "saida",
        profissional: "Dr. João",
        data: expect.any(String),
      });
    });
  });
});

describe("MovimentacaoProfissionalModal -- exclusão de documento sem o usuário trocar de tipo (2ª rodada de code review, STC-437)", () => {
  it("documento confirmado com sucesso continua visível (com o badge 'Confirmado') mesmo depois que a revalidação disparada pelo próprio sucesso devolve ele como Vencido", async () => {
    // Achado no code review: a revalidação que o próprio reportar() dispara
    // em caso de sucesso (mutate(ehChaveDeListaDeDocumentos), useMovimentacaoProfissional.ts)
    // podia trazer o documento recém-confirmado já como Vencido (STC-436:
    // "saida" confirmada vira Vencido na hora, sem esperar a varredura
    // diária) -- sem manter ids já envolvidos na lista, a linha inteira
    // (badge incluído) sumia da tela no meio de um sucesso parcial.
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => {
        if (id === 11) throw new Error("Falha de rede.");
        return { ...CNES, id };
      },
    );
    vi.mocked(listarDocumentosLegalizacao)
      .mockResolvedValueOnce([CNES, CREMERJ])
      .mockResolvedValueOnce([{ ...CNES, status: "vencido" }, CREMERJ]);
    const user = userEvent.setup();
    renderComponente(true, CNES);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledTimes(2);
    });
    const linhaCnes = screen.getByText("CNES").closest("div")!.parentElement!;
    expect(within(linhaCnes).getByText("Confirmado")).toBeInTheDocument();
  });

  it("documento marcado com erro, que vira Vencido numa revalidação sem o usuário trocar de tipo, continua visível com aviso -- 'Tentar novamente' não vira clique sem efeito", async () => {
    // Achado no code review: o mesmo buraco do teste acima também se aplica
    // a um documento com erro pendente (aguardando retry) -- ele podia virar
    // Vencido "por conta própria" (poll de 60s, ou -- como simulado aqui --
    // a mesma revalidação que o sucesso de um documento-irmão já dispara),
    // sumindo da tela junto com o erro que estava sendo mostrado, sem
    // nenhuma ação do usuário.
    vi.mocked(reportarMovimentacaoProfissional).mockImplementation(
      async (id) => {
        if (id === 11) throw new Error("Falha de rede.");
        return { ...CNES, id };
      },
    );
    vi.mocked(listarDocumentosLegalizacao)
      .mockResolvedValueOnce([CNES, CREMERJ])
      .mockResolvedValueOnce([
        { ...CNES, status: "vencido" },
        { ...CREMERJ, status: "vencido" },
      ]);
    const user = userEvent.setup();
    renderComponente(true, CNES);
    await screen.findByText("CNES");
    await preencherObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Confirmar saída" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    // A revalidação disparada pelo sucesso do CNES (reportar() -> mutate)
    // devolve CREMERJ também como Vencido -- a linha continua visível, com
    // o aviso de que não é mais elegível.
    await waitFor(() => {
      expect(
        screen.getByText(
          /passou a Vencido -- não pode mais ser reportado como saída/i,
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Registro CREMERJ")).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Registro CREMERJ").closest("div")!,
      ).getByRole("alert"),
    ).toHaveTextContent(/não foi possível/i);
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeDisabled();
  });

  it("mostra mensagem específica (não 'nenhum documento cadastrado') quando os documentos existem mas estão todos Vencidos pra Saída", async () => {
    // Achado no code review: a mensagem de estado vazio afirmava que nenhum
    // documento estava cadastrado na unidade, mesmo quando o documento
    // existia e só estava excluído pela regra de "saida" + Vencido
    // (STC-436) -- cenário plausível ao abrir o modal a partir do próprio
    // documento já Vencido (o botão "Reportar Movimentação" não bloqueia
    // isso em DetalheDocumentoModal.tsx).
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      COREN_VENCIDO,
    ]);
    renderComponente();

    expect(
      await screen.findByText(
        /já estão Vencidos -- não há nada pra reportar como saída/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nenhum documento regulado/i),
    ).not.toBeInTheDocument();
  });
});
