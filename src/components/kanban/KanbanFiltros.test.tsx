import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandaFiltros, TipoGestao, Usuario } from "@/types";
import { KanbanFiltros } from "./KanbanFiltros";

// Mesma estratégia de KanbanBoard.test.tsx: auto-mock, só o que cada teste
// controla de verdade recebe mockResolvedValue explícito.
vi.mock("@/lib/plataforma");
vi.mock("@/lib/demandas");

import { listarSetores, listarUnidades, listarUsuarios } from "@/lib/plataforma";
import { listarCategorias, listarTiposGestao } from "@/lib/demandas";

const TIPO_GESTAO_OPERACIONAL: TipoGestao = {
  id: 1,
  modulo: 1,
  nome: "Operacional",
  codigo: "operacional",
  descricao: "",
  visibilidade_padrao: "todos",
  ativo: true,
  ordem: 0,
};

const TIPO_GESTAO_UNIDADES: TipoGestao = {
  ...TIPO_GESTAO_OPERACIONAL,
  id: 2,
  nome: "Unidades",
  codigo: "unidades",
  ordem: 1,
};

function usuario(overrides: Partial<Usuario>): Usuario {
  return {
    id: 1,
    username: "user",
    email: "user@grupobrmed.com.br",
    first_name: "User",
    last_name: "Um",
    perfil: null,
    unidade_id: null,
    setor_id: null,
    ativo: true,
    ultimo_acesso: null,
    foto_url: "",
    ...overrides,
  };
}

const ADMIN_QG = usuario({
  id: 1,
  first_name: "Admin",
  last_name: "QG",
  perfil: { id: 1, nome: "Admin Q&G", descricao: "", nivel: 1 },
});
const ADMIN_OPERACOES = usuario({
  id: 2,
  first_name: "Admin",
  last_name: "Operações",
  perfil: { id: 2, nome: "Admin Operações", descricao: "", nivel: 2 },
});
const USUARIO_UNIDADE = usuario({
  id: 3,
  first_name: "Usuário",
  last_name: "Unidade",
  perfil: { id: 3, nome: "Unidade", descricao: "", nivel: 3 },
});

function renderFiltros(filtros: DemandaFiltros) {
  const onMudarFiltros = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <KanbanFiltros filtros={filtros} onMudarFiltros={onMudarFiltros} onNovaDemanda={vi.fn()} />
    </SWRConfig>,
  );
  return { onMudarFiltros };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUnidades).mockResolvedValue([]);
  vi.mocked(listarCategorias).mockResolvedValue([]);
  vi.mocked(listarSetores).mockResolvedValue([]);
  vi.mocked(listarUsuarios).mockResolvedValue([ADMIN_QG, ADMIN_OPERACOES, USUARIO_UNIDADE]);
});

describe("KanbanFiltros -- candidatos do filtro Responsável", () => {
  it("tipo de gestão Operacional: só lista Admin Operações", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_OPERACIONAL]);
    const user = userEvent.setup();
    renderFiltros({ tipo_gestao: TIPO_GESTAO_OPERACIONAL.id });

    await user.click(await screen.findByLabelText("Responsável"));

    expect(await screen.findByRole("option", { name: "Admin Operações" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin QG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Usuário Unidade" })).not.toBeInTheDocument();
  });

  it("tipo de gestão Unidades: lista todos menos Admin Q&G", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNIDADES]);
    const user = userEvent.setup();
    renderFiltros({ tipo_gestao: TIPO_GESTAO_UNIDADES.id });

    await user.click(await screen.findByLabelText("Responsável"));

    expect(await screen.findByRole("option", { name: "Admin Operações" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Usuário Unidade" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin QG" })).not.toBeInTheDocument();
  });

  it("selecionar um responsável chama onMudarFiltros com o id dele", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNIDADES]);
    const user = userEvent.setup();
    const { onMudarFiltros } = renderFiltros({ tipo_gestao: TIPO_GESTAO_UNIDADES.id });

    await user.click(await screen.findByLabelText("Responsável"));
    await user.click(await screen.findByRole("option", { name: "Admin Operações" }));

    expect(onMudarFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ responsavel: ADMIN_OPERACOES.id }),
    );
  });
});

describe("KanbanFiltros -- filtro Área Responsável", () => {
  // STC-392: achado no code review -- SeletorAreaResponsavel não tinha
  // como receber um nome acessível externo, então o filtro perdeu o
  // aria-label="Área Responsável" que o Select antigo tinha. Sem esse
  // teste, nada aqui detectaria uma regressão futura (o gatilho continua
  // clicável mesmo sem nome acessível nenhum -- só um leitor de tela
  // notaria).
  it("gatilho tem nome acessível 'Área Responsável'", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_OPERACIONAL]);
    renderFiltros({ tipo_gestao: TIPO_GESTAO_OPERACIONAL.id });

    expect(await screen.findByLabelText("Área Responsável")).toBeInTheDocument();
  });

  it("selecionar uma área chama onMudarFiltros com a lista", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_OPERACIONAL]);
    const user = userEvent.setup();
    const { onMudarFiltros } = renderFiltros({ tipo_gestao: TIPO_GESTAO_OPERACIONAL.id });

    await user.click(await screen.findByLabelText("Área Responsável"));
    await user.click(await screen.findByRole("checkbox", { name: "Gerência" }));

    expect(onMudarFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ area_responsavel: ["gerencia"] }),
    );
  });

  // STC-392: pedido no dogfooding -- "Todas as áreas responsáveis" vira uma
  // opção de verdade na lista (mesmo padrão dos filtros vizinhos, tipo
  // "Todos os setores origem"), não só o texto do gatilho vazio. Diferente
  // deles (single-select, marca só "todos"), aqui é multi-seleção: marca as
  // 4 de uma vez / desmarca todas se já estiverem todas marcadas.
  it("opção 'Todas as áreas responsáveis' marca as 4 de uma vez", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_OPERACIONAL]);
    const user = userEvent.setup();
    const { onMudarFiltros } = renderFiltros({ tipo_gestao: TIPO_GESTAO_OPERACIONAL.id });

    await user.click(await screen.findByLabelText("Área Responsável"));
    await user.click(await screen.findByRole("checkbox", { name: "Todas as áreas responsáveis" }));

    expect(onMudarFiltros).toHaveBeenCalledWith(
      expect.objectContaining({
        area_responsavel: ["gerencia", "processo", "qualidade", "desenvolvimento"],
      }),
    );
  });

  it("opção 'Todas as áreas responsáveis' desmarca todas quando já estão todas marcadas", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_OPERACIONAL]);
    const user = userEvent.setup();
    const { onMudarFiltros } = renderFiltros({
      tipo_gestao: TIPO_GESTAO_OPERACIONAL.id,
      area_responsavel: ["gerencia", "processo", "qualidade", "desenvolvimento"],
    });

    await user.click(await screen.findByLabelText("Área Responsável"));
    await user.click(await screen.findByRole("checkbox", { name: "Todas as áreas responsáveis" }));

    // area_responsavel: undefined (não []) -- mesma representação de "sem
    // filtro aplicado" usada pelos outros filtros (KanbanFiltros.tsx
    // converte lista vazia pra undefined antes de chamar onMudarFiltros).
    expect(onMudarFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ area_responsavel: undefined }),
    );
  });
});

describe("KanbanFiltros -- filtro de Unidade (STC-510)", () => {
  it("pede unidades da rede padrão, não misturando com as de Operações Especiais", async () => {
    renderFiltros({});

    expect(listarUnidades).toHaveBeenCalledWith("padrao");
  });

  // Achado testando ao vivo: a aba "OPEX" mostrava as filiais normais no
  // filtro de Unidade -- useUnidades("padrao") estava fixo, sem acompanhar
  // qual aba de Tipo Gestão está ativa.
  it("aba OPEX ativa pede unidades da rede opex, não a padrão", async () => {
    const TIPO_GESTAO_OPEX: TipoGestao = {
      ...TIPO_GESTAO_OPERACIONAL,
      id: 3,
      nome: "OPEX",
      codigo: "opex",
      visibilidade_padrao: "opex",
      ordem: 2,
    };
    vi.mocked(listarTiposGestao).mockResolvedValue([
      TIPO_GESTAO_OPERACIONAL,
      TIPO_GESTAO_UNIDADES,
      TIPO_GESTAO_OPEX,
    ]);

    renderFiltros({ tipo_gestao: TIPO_GESTAO_OPEX.id });

    // "padrao" pode ser chamado numa 1ª renderização transitória (antes de
    // tiposGestao carregar, tipoGestaoAtivo ainda é undefined) -- o que
    // importa é que, assim que a aba ativa é conhecida, a chamada final é
    // "opex", não "padrao".
    await waitFor(() => {
      const ultimaChamada = vi.mocked(listarUnidades).mock.calls.at(-1);
      expect(ultimaChamada).toEqual(["opex"]);
    });
  });
});

describe("KanbanFiltros em ver como (STC-790)", () => {
  afterEach(() => sessionStorage.clear());

  it("Nova Demanda desabilitada, com a dica de somente leitura", () => {
    sessionStorage.setItem("atlas.verComo", JSON.stringify({"id":"6f1c2a7e-0000-4000-8000-000000000001","usuario":{"id":7,"nome":"Coordenação"},"admin":{"id":1,"nome":"Admin"},"iniciada_em":"2026-10-19T15:00:00Z","expira_em":"2099-10-19T16:00:00Z"}));
    renderFiltros({} as DemandaFiltros);

    const botao = screen.getByRole("button", { name: "Nova Demanda" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("title", expect.stringContaining("Somente leitura"));
  });

  it("fora do ver como, habilitada", () => {
    renderFiltros({} as DemandaFiltros);
    expect(screen.getByRole("button", { name: "Nova Demanda" })).toBeEnabled();
  });
});

