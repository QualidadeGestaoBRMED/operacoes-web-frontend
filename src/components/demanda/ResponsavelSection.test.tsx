import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import type { Demanda, DemandaResponsavel, Usuario } from "@/types";
import { ResponsavelSection } from "./ResponsavelSection";

// Auto-mock: mesma estratégia de KanbanBoard.test.tsx/FormNovaDemanda.test.tsx.
vi.mock("@/lib/demandas");
vi.mock("@/lib/plataforma");
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import {
  adicionarResponsavel,
  removerResponsavel,
  trocarPrincipalResponsavel,
} from "@/lib/demandas";
import { listarUsuarios } from "@/lib/plataforma";

const NOVO_PRINCIPAL: Usuario = {
  id: 3,
  username: "novo",
  email: "novo@grupobrmed.com.br",
  first_name: "Novo",
  last_name: "Principal",
  perfil: null,
  unidade_id: 1,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
};

const COLABORADOR_EXISTENTE: Usuario = {
  id: 5,
  username: "colaborador",
  email: "colaborador@grupobrmed.com.br",
  first_name: "Colaborador",
  last_name: "Existente",
  perfil: null,
  unidade_id: 1,
  setor_id: null,
  ativo: true,
  ultimo_acesso: null,
  foto_url: "",
};

function responsavelColaboradorExistente(): DemandaResponsavel {
  return { id: 2, tipo: "colaborador", usuario: COLABORADOR_EXISTENTE };
}

function renderSecao(
  responsaveis: DemandaResponsavel[] = [responsavelPrincipal()],
  overrides: Partial<Demanda> = {},
) {
  const demanda = criarDemanda({ responsaveis, ...overrides });
  const aoAbrir = vi.fn();
  const aoFechar = vi.fn();
  const resultado = render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ResponsavelSection
        demanda={demanda}
        podeEscrever
        ativo
        aoAbrir={aoAbrir}
        aoFechar={aoFechar}
      />
    </SWRConfig>,
  );
  // Pra simular o rerender com a demanda pós-troca: ResponsavelSection não
  // lê do SWR sozinha (a revalidação via useTrocarPrincipal acontece um
  // nível acima, em DetalheCard/useDemanda) -- rerenderizar com uma nova
  // prop `demanda` reproduz exatamente o que o pai faria depois que a
  // revalidação responder.
  function rerenderizarCom(demandaAtualizada: Demanda) {
    resultado.rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ResponsavelSection
          demanda={demandaAtualizada}
          podeEscrever
          ativo
          aoAbrir={aoAbrir}
          aoFechar={aoFechar}
        />
      </SWRConfig>,
    );
  }
  return { demanda, aoAbrir, aoFechar, rerenderizarCom };
}

async function abrirFormularioDeTroca(user: ReturnType<typeof userEvent.setup>) {
  // Único responsável é principal -- ehUnicoPrincipal() troca o botão de
  // remover pelo de "Trocar" (mesmo achado documentado no componente).
  await user.click(screen.getByRole("button", { name: /trocar/i }));
  await user.click(screen.getByLabelText(/usuário responsável/i));
  await user.click(await screen.findByRole("option", { name: "Novo Principal" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarUsuarios).mockResolvedValue([NOVO_PRINCIPAL]);
});

describe("ResponsavelSection -- troca de principal (STC-230/STC-231)", () => {
  it("faz a troca com uma única chamada atômica, não mais adicionar+remover separados", async () => {
    vi.mocked(trocarPrincipalResponsavel).mockResolvedValue([]);
    const user = userEvent.setup();
    const { aoFechar } = renderSecao();

    await abrirFormularioDeTroca(user);
    await user.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() => {
      expect(trocarPrincipalResponsavel).toHaveBeenCalledWith(
        expect.any(Number),
        responsavelPrincipal().usuario.id,
        NOVO_PRINCIPAL.id,
      );
    });
    // Antes, aoTrocarPrincipal chamava adicionar()/remover() em sequência --
    // o rewire pra trocarPrincipal() elimina os dois passos independentes
    // que podiam deixar a troca pela metade se o segundo falhasse.
    expect(adicionarResponsavel).not.toHaveBeenCalled();
    expect(removerResponsavel).not.toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("mostra erro e não fecha o formulário quando a troca falha", async () => {
    vi.mocked(trocarPrincipalResponsavel).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    const { aoFechar } = renderSecao();

    await abrirFormularioDeTroca(user);
    await user.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(aoFechar).not.toHaveBeenCalled();
  });

  // Achado no code review do Tech Lead: os dois testes acima só cobrem
  // promover um usuário NOVO a principal -- candidatosParaTrocarPrincipal
  // também aceita um colaborador já existente na própria demanda (achado
  // anterior do Tech Lead, ver comentário na função), caminho que o
  // backend trata como "promove em vez de duplicar" (STC-231). Este teste
  // cobre esse caso pelo lado do frontend: a chamada não deve tentar
  // adicionar+remover à parte, e a lista renderizada (via rerender com a
  // demanda pós-troca, o que o SWR faria de verdade após a revalidação)
  // precisa refletir UMA linha só -- sem o colaborador duplicado, sem o
  // principal antigo, com o promovido marcado "principal".
  it("promove colaborador existente a principal sem duplicar, e a lista reflete a troca", async () => {
    vi.mocked(listarUsuarios).mockResolvedValue([COLABORADOR_EXISTENTE]);
    vi.mocked(trocarPrincipalResponsavel).mockResolvedValue([responsavelColaboradorExistente()]);
    const user = userEvent.setup();
    const { demanda, aoFechar, rerenderizarCom } = renderSecao([
      responsavelPrincipal(),
      { ...responsavelColaboradorExistente(), tipo: "colaborador" },
    ]);

    await user.click(screen.getByRole("button", { name: /trocar/i }));
    await user.click(screen.getByLabelText(/usuário responsável/i));
    await user.click(await screen.findByRole("option", { name: "Colaborador Existente" }));
    await user.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() => {
      expect(trocarPrincipalResponsavel).toHaveBeenCalledWith(
        expect.any(Number),
        responsavelPrincipal().usuario.id,
        COLABORADOR_EXISTENTE.id,
      );
    });
    expect(adicionarResponsavel).not.toHaveBeenCalled();
    expect(removerResponsavel).not.toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();

    rerenderizarCom({
      ...demanda,
      responsaveis: [{ ...responsavelColaboradorExistente(), tipo: "principal" }],
    });

    expect(screen.getAllByText("Colaborador Existente")).toHaveLength(1);
    expect(screen.getByText("principal")).toBeInTheDocument();
    expect(screen.queryByText("Responsável Um")).not.toBeInTheDocument();
  });
});

describe("ResponsavelSection -- pré-seleção do tipo ao adicionar", () => {
  it("pré-seleciona Principal quando a demanda ainda não tem um", async () => {
    const user = userEvent.setup();
    renderSecao([]);

    await user.click(screen.getByRole("button", { name: "Adicionar responsável" }));

    expect(screen.getByLabelText(/tipo de responsável/i)).toHaveTextContent("Principal");
  });

  it("pré-seleciona Colaborador quando a demanda já tem um Principal", async () => {
    const user = userEvent.setup();
    renderSecao([responsavelPrincipal()]);

    await user.click(screen.getByRole("button", { name: "Adicionar responsável" }));

    expect(screen.getByLabelText(/tipo de responsável/i)).toHaveTextContent("Colaborador");
  });
});

describe("ResponsavelSection -- elegibilidade em demanda Operacional", () => {
  it("só lista candidatos com perfil Admin Operações", async () => {
    const adminOperacoes: Usuario = {
      ...NOVO_PRINCIPAL,
      id: 7,
      username: "admin-ops",
      first_name: "Admin",
      last_name: "Operações",
      perfil: { id: 1, nome: "Admin Operações", descricao: "", nivel: 2 },
    };
    const usuarioComum: Usuario = { ...COLABORADOR_EXISTENTE, perfil: null };
    vi.mocked(listarUsuarios).mockResolvedValue([adminOperacoes, usuarioComum]);
    const user = userEvent.setup();
    renderSecao([], { unidade: null, area_responsavel: ["gerencia"] });

    await user.click(screen.getByRole("button", { name: "Adicionar responsável" }));
    await user.click(screen.getByLabelText(/usuário responsável/i));

    expect(await screen.findByRole("option", { name: "Admin Operações" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Colaborador Existente" })).not.toBeInTheDocument();
  });
});

describe("ResponsavelSection -- unidades adicionais (STC-862)", () => {
  it("quem tem a unidade da demanda como adicional aparece como candidato", async () => {
    const comAdicional: Usuario = {
      ...COLABORADOR_EXISTENTE,
      id: 8,
      first_name: "Coordenadora",
      last_name: "Duas Unidades",
      unidade_id: 2,
      unidades_adicionais_ids: [1],
    };
    const deOutraUnidade: Usuario = {
      ...COLABORADOR_EXISTENTE,
      id: 9,
      first_name: "Outra",
      last_name: "Unidade",
      unidade_id: 2,
    };
    vi.mocked(listarUsuarios).mockResolvedValue([comAdicional, deOutraUnidade]);
    const user = userEvent.setup();
    renderSecao([]);

    await user.click(screen.getByRole("button", { name: "Adicionar responsável" }));
    await user.click(screen.getByLabelText(/usuário responsável/i));

    expect(
      await screen.findByRole("option", { name: "Coordenadora Duas Unidades" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Outra Unidade" })).not.toBeInTheDocument();
  });
});

describe("ResponsavelSection -- elegibilidade pela rede da demanda (STC-747)", () => {
  it("demanda de aeroclínica sugere o Admin Operações Especiais, não o Admin Operações", async () => {
    const semUnidade = { ...NOVO_PRINCIPAL, unidade_id: null };
    const adminOps: Usuario = {
      ...semUnidade,
      id: 7,
      username: "fernanda",
      first_name: "Fernanda",
      last_name: "Ops",
      perfil: { id: 2, nome: "Admin Operações", descricao: "", nivel: 2 },
    };
    const adminOpex: Usuario = {
      ...semUnidade,
      id: 8,
      username: "juliana",
      first_name: "Juliana",
      last_name: "Opex",
      perfil: { id: 7, nome: "Admin Operações Especiais", descricao: "", nivel: 7 },
    };
    vi.mocked(listarUsuarios).mockResolvedValue([adminOps, adminOpex]);
    const user = userEvent.setup();
    renderSecao([], {
      unidade: {
        id: 9,
        nome: "Aeroclínica Macaé",
        codigo: "AMC",
        cidade: "Macaé",
        ativa: true,
        rede: "opex",
      },
    });

    await user.click(screen.getByRole("button", { name: "Adicionar responsável" }));
    await user.click(screen.getByLabelText(/usuário responsável/i));

    expect(await screen.findByRole("option", { name: "Juliana Opex" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Fernanda Ops" })).not.toBeInTheDocument();
  });
});

describe("ResponsavelSection, foto do Google (STC-795)", () => {
  it("responsável com foto mostra a foto; sem foto, as iniciais", () => {
    renderSecao([
      { id: 1, tipo: "principal", usuario: { ...NOVO_PRINCIPAL, foto_url: "https://foto.exemplo/novo.jpg" } },
      responsavelColaboradorExistente(),
    ]);

    const fotos = [...document.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(fotos).toEqual(["https://foto.exemplo/novo.jpg"]);
    expect(screen.getByText("CE")).toBeInTheDocument();
  });
});
