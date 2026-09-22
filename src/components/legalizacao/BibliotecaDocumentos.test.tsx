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
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
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
  rede: "padrao",
};

const VITORIA: Unidade = {
  id: 2,
  nome: "Vitória",
  codigo: "VIT",
  cidade: "Vitória",
  ativa: true,
  rede: "padrao",
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
    permite_multiplas_instancias: false,
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
  vi.mocked(useAuth).mockReturnValue({
    user: undefined,
    perfil: undefined,
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
    isCoordenacaoUnidade: false,
  } as never);
  vi.mocked(urlAbsolutaDaEvidencia).mockImplementation((url) => url);
  vi.mocked(listarUnidades).mockResolvedValue([NITEROI, VITORIA]);
  vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([]);
  vi.mocked(listarEvidenciasVigentes).mockResolvedValue([]);

  // O painel de preview busca os bytes do PDF via
  // /api/media/evidencia-vigente (proxy same-origin, ver BibliotecaDocumentos.tsx)
  // e monta uma Blob URL local -- sem mockar fetch/URL aqui, o fetch real
  // falhava (URL relativa sem host) e o iframe nunca aparecia.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["%PDF-fake"], { type: "application/pdf" })),
  } as Response);
  global.URL.createObjectURL = vi.fn(() => "blob:mock-evidencia");
  global.URL.revokeObjectURL = vi.fn();
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
    // Botão de baixar é só ícone (achado no feedback visual) -- nome
    // acessível cai pro title="Baixar", não tem mais texto "PDF" visível.
    expect(screen.getByRole("link", { name: "Baixar" })).toHaveAttribute(
      "href",
      expect.stringContaining("/media/evidencias/alvara.pdf"),
    );
    // validade 2027-01-01 (bem no futuro, urgencia "normal") -- achado no
    // feedback visual: "em N dias" vira ilegível pra prazos longos, mostra
    // a data absoluta em vez de contagem regressiva nesse caso.
    expect(screen.getByText(/Válido até 01\/01\/2027/)).toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Baixar" })).not.toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("Nenhum arquivo cadastrado")).toBeInTheDocument();
  });

  // Achado em code review: faltava cobertura pra essas duas regras de cor,
  // e as duas tinham bug (ícone usava só `evidencia`, ficando vermelho num
  // documento regular; esmaecimento não existia no código, apesar do
  // critério de aceite pedir).
  it("documento sem evidência e NÃO vencido aparece esmaecido; vencido sem evidência fica em destaque total", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([
      documento({
        id: 20,
        evidencia_vigente: null,
        status: "nao_iniciado",
        tipo_documento: tipo({ id: 3, codigo: "crm", nome: "CRM" }),
      }),
      documento({ id: 21, evidencia_vigente: null, status: "vencido" }),
    ]);
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([]);

    renderTela();

    const cardNaoIniciado = (await screen.findByText("CRM")).closest("div.rounded-lg");
    expect(cardNaoIniciado).toHaveClass("opacity-60");

    const cardVencido = screen.getByText("Alvará de Funcionamento").closest("div.rounded-lg");
    expect(cardVencido).not.toHaveClass("opacity-60");
  });

  it("ícone do documento com evidência é vermelho só quando vencido; regular usa verde", async () => {
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]); // status "regular"
    vi.mocked(listarEvidenciasVigentes).mockResolvedValue([evidencia()]);

    renderTela();

    const botaoNome = await screen.findByRole("button", { name: "Alvará de Funcionamento" });
    const icone = botaoNome.closest("div.rounded-lg")?.querySelector(".rounded-md");
    expect(icone).toHaveClass("bg-green-600");
    expect(icone).not.toHaveClass("bg-red-600");
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
    // src é uma Blob URL montada a partir do proxy (ver useEffect em
    // BibliotecaDocumentos.tsx), não a URL do arquivo em si.
    const iframe = await screen.findByTitle("Pré-visualização de alvara.pdf");
    expect(iframe).toHaveAttribute("src", "blob:mock-evidencia#toolbar=0&navpanes=0&scrollbar=0");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/media/evidencia-vigente?documento=10"),
    );
    // Button asChild (achado em code review) projeta o <a> como raiz --
    // role vira "link", não "button", pra não aninhar dois elementos
    // interativos no DOM.
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toBeInTheDocument();

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
    expect(await screen.findByTitle(/Pré-visualização/)).toBeInTheDocument();

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

  it("mostra mensagem específica (não fica em 'Carregando...' pra sempre) quando não há nenhuma unidade cadastrada", async () => {
    // Achado numa checagem de falhas críticas: sem isto, unidades=[] deixava
    // unidadeId indefinido pra sempre (o efeito que escolhe a 1ª unidade
    // nunca acha pra onde ir) -- a tela ficava presa em "Carregando..."
    // eternamente, sem nenhum estado de saída (diferente da Matriz, onde
    // "nenhuma unidade" é um estado válido).
    vi.mocked(listarUnidades).mockResolvedValue([]);

    renderTela();

    expect(await screen.findByText("Nenhuma unidade cadastrada.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
  });
});

describe("BibliotecaDocumentos -- Coordenador só vê a própria unidade (STC-512)", () => {
  it("cai direto pra própria unidade, não pra 1ª da lista", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: VITORIA.id },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    // NITEROI vem primeiro na lista (mesma ordem de todos os outros
    // testes) -- sem o filtro, o fallback de auto-seleção escolheria ela
    // em vez da unidade real do Coordenador.
    vi.mocked(listarDocumentosLegalizacao).mockResolvedValue([documento()]);

    renderTela();

    await waitFor(() => {
      expect(listarDocumentosLegalizacao).toHaveBeenCalledWith({ unidade: VITORIA.id });
    });
  });

  it("Select de unidade só oferece a própria, não as outras da rede", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { unidade_id: VITORIA.id },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    const user = userEvent.setup();
    renderTela();

    await user.click(await screen.findByLabelText("Unidade"));

    expect(await screen.findByRole("option", { name: "Vitória" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Niterói" })).not.toBeInTheDocument();
  });

  // Achado no review: isCoordenacaoUnidade nasce false enquanto a sessão
  // carrega (useAuth.ts) -- sem esperar por ela, o auto-select podia
  // escolher a 1ª unidade da REDE INTEIRA (Niterói, aqui) e chegar a buscar
  // os documentos dela antes da sessão resolver e corrigir pra própria
  // unidade do Coordenador.
  it("não busca documentos antes da sessão carregar, mesmo com as unidades já disponíveis", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      perfil: undefined,
      isLoading: true,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: false,
    } as never);

    renderTela();

    await waitFor(() => expect(listarUnidades).toHaveBeenCalled());
    expect(listarDocumentosLegalizacao).not.toHaveBeenCalled();
  });
});
