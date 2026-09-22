import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda as construirDemandaFixture } from "@/test-utils/fixtures";
import type { TipoGestao, Unidade } from "@/types";
import { FormNovaDemanda } from "./FormNovaDemanda";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { usuarioId: 1, perfil: { id: 1, nome: "Admin Operações", nivel: 2 } },
    perfil: { id: 1, nome: "Admin Operações", nivel: 2 },
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
  }),
}));

// Auto-mock: mesma estratégia do KanbanBoard.test.tsx -- só o que os
// testes controlam explicitamente ganha implementação, o resto (categorias,
// setores, etiquetas) fica `undefined` e os hooks já tratam como `?? []`.
vi.mock("@/lib/demandas");
vi.mock("@/lib/plataforma");

import { criarDemanda, listarTiposGestao } from "@/lib/demandas";
import { listarUnidades } from "@/lib/plataforma";

const TIPO_GESTAO: TipoGestao = {
  id: 1,
  modulo: 1,
  nome: "Operacional",
  codigo: "operacional",
  descricao: "",
  visibilidade_padrao: "todos",
  ativo: true,
  ordem: 0,
};

const UNIDADE: Unidade = {
  id: 1,
  nome: "Niterói",
  codigo: "NIT",
  cidade: "Niterói",
  ativa: true,
  rede: "padrao",
};

function renderForm(onOpenChange = vi.fn()) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormNovaDemanda open onOpenChange={onOpenChange} />
    </SWRConfig>,
  );
  return { onOpenChange };
}

// Preenche os campos obrigatórios (mesmos seletores já validados nos
// scripts E2E manuais dessa sessão) e mantém as respostas prontas.
//
// Unidade/Tipo de gestão selecionados por nome acessível (getByLabelText),
// não por posição no array de comboboxes -- achado no review da STC-171
// (Linear): selecionar por posição (comboboxes[0]/[2]) é frágil a qualquer
// mudança de layout. Só passou a funcionar depois da STC-215, que associou
// <Label htmlFor> ao SelectTrigger correspondente em FormNovaDemanda.tsx
// (antes, o rótulo era só visual, sem nome acessível nenhum no campo).
async function preencherCamposObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/título/i), "Trocar lâmpada do corredor");
  await user.type(screen.getByLabelText(/descrição/i), "Lâmpada queimada há 2 dias.");
  await user.click(screen.getByRole("button", { name: "Média" }));
  await user.type(screen.getByLabelText(/prazo/i), "2026-12-31");

  // Tipo de gestão primeiro: TIPO_GESTAO é codigo="operacional", então
  // selecioná-lo troca o campo seguinte de "Unidade" pra "Responsável"
  // (mutuamente exclusivos -- ver FormNovaDemanda.tsx). Selecionar Unidade
  // antes seria preencher um campo que a própria seleção de tipo remove.
  await user.click(screen.getByLabelText(/tipo de gestão/i));
  await user.click(await screen.findByRole("option", { name: "Operacional" }));
  // findByLabelText (não getByLabelText): o campo de Área Responsável só
  // existe no DOM depois que o React re-renderiza trocando Unidade->Área
  // Responsável -- uma query síncrona aqui corre contra esse re-render
  // (achado rodando a suíte inteira repetidas vezes: falhava por timeout
  // ~1 a cada 3 rodadas, nunca isolado). SeletorAreaResponsavel (STC-391) é
  // Popover+Checkbox, não um Select -- sem role="combobox"/"option" pra
  // usar aqui; getByLabelText funciona porque o gatilho tem
  // id="f-area-responsavel" associado ao <Label htmlFor> (achado no code
  // review: tinha sumido na primeira versão do componente).
  await user.click(await screen.findByLabelText(/área responsável/i));
  await user.click(await screen.findByRole("checkbox", { name: "Gerência" }));
}

beforeEach(() => {
  // resetAllMocks (não clearAllMocks) -- zera implementação, não só
  // histórico de chamadas. Mesmo achado do autoreview de
  // KanbanBoard.test.tsx: sem isso, um mockResolvedValue/mockRejectedValue
  // de um teste anterior sobrevive silenciosamente pro próximo.
  vi.resetAllMocks();
  vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO]);
  vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
});

describe("FormNovaDemanda", () => {
  it("cria a demanda com o payload esperado e fecha o modal", async () => {
    vi.mocked(criarDemanda).mockResolvedValue(construirDemandaFixture());
    const user = userEvent.setup();
    const { onOpenChange } = renderForm();

    await preencherCamposObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    await waitFor(() => {
      expect(criarDemanda).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: "Trocar lâmpada do corredor",
          descricao: "Lâmpada queimada há 2 dias.",
          prioridade: "media",
          unidade: null,
          area_responsavel: ["gerencia"],
          tipo_gestao: TIPO_GESTAO.id,
          data_prevista: "2026-12-31",
          confidencial: false,
          etiquetas: [],
        }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // STC-391: area_responsavel virou lista -- confirma que dá pra marcar mais
  // de uma sem desmarcar a anterior, e que as duas vão juntas no payload.
  it("aceita mais de uma área responsável ao mesmo tempo", async () => {
    vi.mocked(criarDemanda).mockResolvedValue(construirDemandaFixture());
    const user = userEvent.setup();
    renderForm();

    await preencherCamposObrigatorios(user);
    await user.click(await screen.findByRole("checkbox", { name: "Processo" }));
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    await waitFor(() => {
      expect(criarDemanda).toHaveBeenCalledWith(
        expect.objectContaining({ area_responsavel: ["gerencia", "processo"] }),
      );
    });
  });

  it("mostra erro e mantém o modal aberto quando a criação falha", async () => {
    vi.mocked(criarDemanda).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    const { onOpenChange } = renderForm();

    await preencherCamposObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    await waitFor(() => {
      expect(criarDemanda).toHaveBeenCalled();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // O form continua na tela, preenchido -- nada foi limpo/fechado no erro.
    expect(screen.getByDisplayValue("Trocar lâmpada do corredor")).toBeInTheDocument();
  });

  it("não envia sem os campos obrigatórios (validação do zod barra o submit)", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    expect(await screen.findByText("Título é obrigatório.")).toBeInTheDocument();
    expect(criarDemanda).not.toHaveBeenCalled();
  });
});
