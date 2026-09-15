import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Unidade } from "@/types";
import type {
  DocumentoUnidade,
  EvidenciaVigente,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import { BibliotecaDocumentos } from "./BibliotecaDocumentos";

// Mesmo padrão de KanbanBoard.test.tsx -- fora de um Router real do Next,
// useRouter/usePathname/useSearchParams quebram. useSearchParams como
// vi.fn() (não valor fixo): o teste de "cai pra 1ª unidade quando o ID da
// URL não existe (mais)" precisa simular uma URL de entrada específica.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: () => "/modulos/legalizacao/biblioteca",
  useSearchParams: vi.fn(),
}));

vi.mock("@/lib/plataforma");
vi.mock("@/lib/legalizacao");

import { listarUnidades } from "@/lib/plataforma";
import {
  listarDocumentosLegalizacao,
  listarEvidenciasVigentes,
  urlAbsolutaDaEvidencia,
} from "@/lib/legalizacao";

const NITEROI: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
};

const VITORIA: Unidade = {
  id: 2,
  nome: "Vitória",
  codigo: "VIT",
  cidade: "Vitória",
  ativa: true,
};

function tipo(overrides: Partial<TipoDocumentoRegulatorio> = {}): TipoDocumentoRegulatorio {
  return {
    id: 1,
    codigo: "alvara-funcionamento",
    nome: "Alvará de Funcionamento",
    categoria: "regularizacao",
    area_responsavel: "legalizacao",
    setor_apoio: "",
    exige_validade: true,
    exige_protocolo: false,
    exige_evidencia: true,
    controlado_por_profissional: false,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function documento(overrides: Partial<DocumentoUnidade> = {}): DocumentoUnidade {
  return {
    id: 10,
    tipo_documento: tipo(),
    unidade: NITEROI,
    status: "regular",
    justificativa_excecao: "",
    validade: "2027-01-01",
    evidencia_vigente: 100,
    regra_aplicada: null,
    responsaveis: [],
    profissional: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function evidencia(overrides: Partial<EvidenciaVigente> = {}): EvidenciaVigente {
  return {
    documento_unidade: 10,
    arquivo: "/media/evidencias/alvara.pdf",
    nome_original: "alvara.pdf",
    tamanho_bytes: 12_345,
    emitido_em: "2026-01-15",
    validade_comprovada: "2027-01-01",
    ...overrides,
  };
}

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <BibliotecaDocumentos />
    </SWRConfig>,
  );
}

const substituirUrl = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useRouter).mockReturnValue({ replace: substituirUrl, push: vi.fn() } as never);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.mocked(urlAbsolutaDaEvidencia).mockImplementation((url) => url);
  vi.mocked(listarUnidades).mockResolvedValue([NITEROI, VITORIA]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(listarEvidenciasVigentes).mockResolvedValue([]);
});

describe("BibliotecaDocumentos (STC-416)", () => {
  it("sem unidade na URL, cai pra 1ª unidade da lista e busca os documentos dela", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([evidencia()]);

    renderTela();

    await screen.findByText("Alvará de Funcionamento");
    expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({ unidade: NITEROI.id });
    expect(listarEvidenciasVigentes).toHaveBeenCalledWith(NITEROI.id);
  });

  it("agrupa documentos por categoria, com contagem, e omite categoria sem nenhum documento", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({ id: 10, tipo_documento: tipo({ categoria: "regularizacao" }) }),
      documento({
        id: 11,
        tipo_documento: tipo({
          id: 2,
          codigo: "cnes",
          nome: "CNES",
          categoria: "registros_tecnicos",
        }),
      }),
    ]);

    renderTela();
    await screen.findByText("Alvará de Funcionamento");

    expect(screen.getByText("Regularização e licenciamento")).toBeInTheDocument();
    expect(screen.getByText("Registros técnicos")).toBeInTheDocument();
    expect(screen.queryByText("Capacitação")).not.toBeInTheDocument();
    expect(screen.queryByText("Resíduos")).not.toBeInTheDocument();
  });

  it("documento com evidência vigente mostra nome clicável, ação de baixar e prazo", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([evidencia()]);

    renderTela();

    expect(
      await screen.findByRole("button", { name: "Alvará de Funcionamento" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pdf/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/media/evidencias/alvara.pdf"),
    );
    // validade 2027-01-01 (bem no futuro) -- prazoDocumento() devolve "em N dias".
    expect(screen.getByText(/em \d+ dias?/)).toBeInTheDocument();
  });

  it("documento sem evidência vigente aparece esmaecido, com o status real, sem link de baixar nem virar botão", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({ evidencia_vigente: null, status: "vencido" }),
    ]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([]);

    renderTela();
    await screen.findByText("Alvará de Funcionamento");

    expect(
      screen.queryByRole("button", { name: "Alvará de Funcionamento" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("Sem evidência vigente cadastrada")).toBeInTheDocument();
  });

  it("clicar no nome do documento abre o painel de pré-visualização com o PDF embutido; clicar de novo fecha", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([evidencia()]);
    const user = userEvent.setup();
    renderTela();
    const botaoDocumento = await screen.findByRole("button", {
      name: "Alvará de Funcionamento",
    });

    await user.click(botaoDocumento);

    expect(screen.getByText("alvara.pdf")).toBeInTheDocument();
    const iframe = screen.getByTitle("Pré-visualização de alvara.pdf");
    expect(iframe).toHaveAttribute("src", expect.stringContaining("/media/evidencias/alvara.pdf"));
    expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeInTheDocument();

    await user.click(botaoDocumento);

    expect(screen.queryByTitle(/Pré-visualização/)).not.toBeInTheDocument();
  });

  it("fechar o painel pelo botão dedicado também funciona", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([evidencia()]);
    const user = userEvent.setup();
    renderTela();
    await user.click(
      await screen.findByRole("button", { name: "Alvará de Funcionamento" }),
    );
    expect(screen.getByTitle(/Pré-visualização/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar pré-visualização" }));

    expect(screen.queryByTitle(/Pré-visualização/)).not.toBeInTheDocument();
  });

  it("trocar de unidade no seletor busca os documentos da nova unidade e atualiza a URL", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);
    const user = userEvent.setup();
    renderTela();
    await screen.findByText("Alvará de Funcionamento");

    await user.click(screen.getByRole("combobox", { name: "Unidade" }));
    await user.click(await screen.findByRole("option", { name: "Vitória" }));

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({ unidade: VITORIA.id });
    });
    expect(substituirUrl).toHaveBeenCalledWith(
      expect.stringContaining(`unidade=${VITORIA.id}`),
      expect.anything(),
    );
  });

  it("um id de unidade na URL que não existe (mais) cai pra 1ª unidade da lista, em vez de travar sem nada", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ unidade: "999" }) as never,
    );
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);

    renderTela();

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({ unidade: NITEROI.id });
    });
  });

  it("com um id de unidade na URL, não busca documentos/evidências com ele até a lista real de unidades confirmar que existe", async () => {
    // Achado em code review (mesma classe de bug já corrigida em
    // MatrizConformidade.tsx): sem pausar o fetch enquanto a lista de
    // unidades ainda carrega, um id de unidade na URL (válido ou não)
    // disparava a busca de documentos/evidências antes da validação
    // acima confirmar que ele existe -- mostrando "nenhum documento" por
    // um instante com o filtro errado ainda ativo.
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ unidade: String(NITEROI.id) }) as never,
    );
    let resolverUnidades: (unidades: Unidade[]) => void = () => {};
    vi.mocked(listarUnidades).mockReturnValue(
      new Promise((resolve) => {
        resolverUnidades = resolve;
      }),
    );

    renderTela();

    await waitFor(() => {
      expect(screen.getByText("Carregando...")).toBeInTheDocument();
    });
    expect(listarDocumentosLegalizacao).not.toHaveBeenCalled();
    expect(listarEvidenciasVigentes).not.toHaveBeenCalled();

    resolverUnidades([NITEROI, VITORIA]);

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({ unidade: NITEROI.id });
    });
  });

  it("mostra erro (não lista vazia) quando a busca de documentos falha", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockRejectedValue(new Error("Falha de rede."));

    renderTela();

    expect(
      await screen.findByText(/não foi possível carregar os documentos desta unidade/i),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de lista vazia quando a unidade não tem nenhum documento cadastrado", async () => {
    renderTela();

    expect(
      await screen.findByText(/nenhum documento regulatório cadastrado nesta unidade/i),
    ).toBeInTheDocument();
  });
});
