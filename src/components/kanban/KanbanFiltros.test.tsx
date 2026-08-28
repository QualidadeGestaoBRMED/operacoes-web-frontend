import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
