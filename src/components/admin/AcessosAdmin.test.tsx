import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Acessos, UsuarioAcesso } from "@/types";
import { AcessosAdmin } from "./AcessosAdmin";

vi.mock("@/lib/plataforma", () => ({ listarAcessos: vi.fn() }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn(() => false) }));
vi.mock("@/lib/kanban", () => ({ hojeNoFusoDoServidor: () => "2026-10-19" }));

import { listarAcessos } from "@/lib/plataforma";

const UNIDADE = { id: 5, nome: "Niterói" };
const COORDENACAO = { id: 3, nome: "Unidade" };
const ADMIN = { id: 1, nome: "Admin Q&G" };

function pessoa(dados: Partial<UsuarioAcesso> & Pick<UsuarioAcesso, "id" | "nome">): UsuarioAcesso {
  return {
    email: `${dados.nome.toLowerCase().replace(/ /g, ".")}@exemplo.com`,
    perfil: null,
    unidade: null,
    setor: null,
    ultimo_uso: null,
    dias_desde_o_ultimo_uso: null,
    dias_com_uso: 0,
    dias: [],
    ...dados,
  };
}

// Na ordem da API: quem nunca entrou, depois quem está há mais tempo sem entrar.
const RESPOSTA: Acessos = {
  periodo: { inicio: "2026-09-20", fim: "2026-10-19" },
  hoje: "2026-10-19",
  usuarios: [
    pessoa({ id: 1, nome: "Bruna Nunca", perfil: COORDENACAO, unidade: UNIDADE }),
    pessoa({
      id: 2,
      nome: "Carlos Sumido",
      perfil: COORDENACAO,
      unidade: UNIDADE,
      ultimo_uso: "2026-10-14",
      dias_desde_o_ultimo_uso: 5,
      dias_com_uso: 3,
      dias: ["2026-09-30", "2026-10-02", "2026-10-14"],
    }),
    pessoa({
      id: 3,
      nome: "Dora Recente",
      perfil: ADMIN,
      setor: { id: 9, nome: "Qualidade" },
      ultimo_uso: "2026-10-17",
      dias_desde_o_ultimo_uso: 2,
      dias_com_uso: 12,
      dias: ["2026-10-17"],
    }),
    pessoa({
      id: 4,
      nome: "Eva Hoje",
      perfil: ADMIN,
      ultimo_uso: "2026-10-19",
      dias_desde_o_ultimo_uso: 0,
      dias_com_uso: 20,
      dias: ["2026-10-19"],
    }),
  ],
};

function renderTela() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <AcessosAdmin hidden={false} />
    </SWRConfig>,
  );
}

function linhas() {
  const tabela = screen.getByRole("table", { name: "Acessos" });
  return within(tabela).getAllByRole("row").slice(1);
}

function nomesNaTabela() {
  return linhas().map((linha) => within(linha).getByRole("button").textContent);
}

beforeEach(() => {
  vi.mocked(listarAcessos).mockReset();
  vi.mocked(listarAcessos).mockResolvedValue(RESPOSTA);
});

describe("AcessosAdmin (STC-746)", () => {
  it("lista na ordem da API, com último uso, dias sem entrar e dias com uso no período", async () => {
    renderTela();
    await screen.findByRole("table", { name: "Acessos" });

    expect(listarAcessos).toHaveBeenCalledWith("2026-09-20");
    expect(nomesNaTabela()).toEqual(["Bruna Nunca", "Carlos Sumido", "Dora Recente", "Eva Hoje"]);
    const [bruna, carlos, dora, eva] = linhas();
    expect(bruna).toHaveTextContent("Nunca entrou");
    expect(bruna).toHaveTextContent("0 de 30");
    expect(carlos).toHaveTextContent("5 dias");
    expect(carlos).toHaveTextContent("14/10/2026");
    expect(carlos).toHaveTextContent("Niterói");
    // Sem unidade, a lotação é o setor.
    expect(dora).toHaveTextContent("Qualidade");
    expect(eva).toHaveTextContent("Entrou hoje");
    expect(eva).toHaveTextContent("Hoje");
  });

  it("destaque a partir de 3 dias sem entrar e para quem nunca entrou", async () => {
    renderTela();
    await screen.findByRole("table", { name: "Acessos" });

    const destacadas = linhas()
      .filter((linha) => linha.hasAttribute("data-destaque"))
      .map((linha) => within(linha).getByRole("button").textContent);
    expect(destacadas).toEqual(["Bruna Nunca", "Carlos Sumido"]);
    expect(screen.getByText(/4 pessoas/)).toHaveTextContent("4 pessoas · 2 em destaque");
  });

  it("filtra por perfil e por unidade, e Limpar filtros volta tudo", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByRole("table", { name: "Acessos" });

    await user.click(screen.getByRole("combobox", { name: "Filtrar por perfil" }));
    await user.click(screen.getByRole("option", { name: "Admin Q&G" }));
    expect(nomesNaTabela()).toEqual(["Dora Recente", "Eva Hoje"]);

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por unidade" }));
    await user.click(screen.getByRole("option", { name: "Niterói" }));
    expect(nomesNaTabela()).toEqual(["Bruna Nunca", "Carlos Sumido"]);

    await user.click(screen.getByRole("combobox", { name: "Filtrar por unidade" }));
    await user.click(screen.getByRole("option", { name: "Sem unidade" }));
    expect(nomesNaTabela()).toEqual(["Dora Recente", "Eva Hoje"]);

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(nomesNaTabela()).toHaveLength(4);
  });

  it("trocar o período busca de novo a partir do novo início", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByRole("table", { name: "Acessos" });

    await user.click(screen.getByRole("combobox", { name: "Período" }));
    await user.click(screen.getByRole("option", { name: "Últimos 12 meses" }));

    expect(listarAcessos).toHaveBeenLastCalledWith("2025-10-20");
  });

  it("detalhe: os dias de uso da pessoa no período, num calendário", async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByRole("table", { name: "Acessos" });

    await user.click(screen.getByRole("button", { name: "Ver os dias de uso de Carlos Sumido" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Carlos Sumido")).toBeInTheDocument();
    expect(dialogo).toHaveTextContent("3 dias com uso de 20/09/2026 a 19/10/2026");
    expect(within(dialogo).getByRole("region", { name: "setembro de 2026" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("region", { name: "outubro de 2026" })).toBeInTheDocument();
    const usados = [...dialogo.querySelectorAll("[data-usou]")].map((dia) => dia.firstChild?.textContent);
    expect(usados).toEqual(["30", "2", "14"]);
  });

  it("erro ao carregar: mensagem, sem tabela", async () => {
    vi.mocked(listarAcessos).mockRejectedValue(new Error("falhou"));
    renderTela();

    expect(await screen.findByText(/Não foi possível carregar os acessos/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
