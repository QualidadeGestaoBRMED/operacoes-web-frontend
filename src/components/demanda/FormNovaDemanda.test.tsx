import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarDemanda as construirDemandaFixture } from "@/test-utils/fixtures";
import type { TipoGestao, Unidade } from "@/types";
import { FormNovaDemanda } from "./FormNovaDemanda";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
// Auto-mock: mesma estratégia do KanbanBoard.test.tsx -- só o que os
// testes controlam explicitamente ganha implementação, o resto (categorias,
// setores, etiquetas) fica `undefined` e os hooks já tratam como `?? []`.
vi.mock("@/lib/demandas");
vi.mock("@/lib/plataforma");

import { useAuth } from "@/hooks/useAuth";
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

// STC-510: qualquer codigo != "operacional" usa o campo Unidade (não Área
// Responsável) -- ver ehOperacional em FormNovaDemanda.tsx.
const TIPO_GESTAO_UNIDADES: TipoGestao = {
  ...TIPO_GESTAO,
  id: 2,
  nome: "Unidades",
  codigo: "unidades",
  visibilidade_padrao: "unidade",
};

const TIPO_GESTAO_OPEX: TipoGestao = {
  ...TIPO_GESTAO,
  id: 3,
  nome: "OPEX",
  codigo: "opex",
  visibilidade_padrao: "opex",
};

const UNIDADE_OPEX: Unidade = {
  id: 2,
  nome: "Aeroclínica Central",
  codigo: "AER1",
  cidade: "Rio de Janeiro",
  ativa: true,
  rede: "opex",
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
  vi.mocked(useAuth).mockReturnValue({
    user: { usuarioId: 1, perfil: { id: 1, nome: "Admin Operações", nivel: 2 } },
    perfil: { id: 1, nome: "Admin Operações", nivel: 2 },
    isLoading: false,
    isAdminQG: false,
    isAdminOps: true,
    isCoordenacaoUnidade: false,
  } as never);
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

describe("FormNovaDemanda -- Select de Unidade acompanha a rede do Tipo de Gestão (STC-510)", () => {
  it("trocar pro tipo de gestão OPEX no formulário troca as unidades oferecidas no Select", async () => {
    // Achado no code review: o formulário fica aberto enquanto o usuário
    // troca de Tipo de gestão (diferente do Kanban, onde a aba já vem
    // fixada) -- esse é o caminho com mais chance de regressão passar
    // despercebido, então listarUnidades devolve listas DIFERENTES por
    // rede (não a mesma lista pros dois), provando que o Select de
    // verdade reflete a rede pedida, não só que o argumento certo foi
    // passado.
    vi.mocked(listarTiposGestao).mockResolvedValue([
      TIPO_GESTAO,
      TIPO_GESTAO_UNIDADES,
      TIPO_GESTAO_OPEX,
    ]);
    vi.mocked(listarUnidades).mockImplementation((rede) =>
      Promise.resolve(rede === "opex" ? [UNIDADE_OPEX] : [UNIDADE]),
    );
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Unidades" }));
    await user.click(await screen.findByLabelText(/^unidade/i));
    expect(await screen.findByRole("option", { name: "Niterói" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Aeroclínica Central" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "OPEX" }));
    await user.click(await screen.findByLabelText(/^unidade/i));

    expect(await screen.findByRole("option", { name: "Aeroclínica Central" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Niterói" })).not.toBeInTheDocument();
  });
});

describe("FormNovaDemanda -- reset não pode rodar de novo com o modal já aberto (STC-538)", () => {
  // Config estável (mesma instância reaproveitada entre render e rerender)
  // -- um objeto novo a cada render recriaria o cache do SWR e mascararia o
  // que este teste quer provar (a mudança de tipoGestaoInicial sozinha, sem
  // fechar/reabrir o modal).
  const configSWR = { provider: () => new Map() };

  it("trocar tipoGestaoInicial com o modal já aberto (achado real: autocorreção assíncrona de KanbanBoard.tsx) não apaga a Unidade já escolhida", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNIDADES]);
    vi.mocked(criarDemanda).mockResolvedValue(construirDemandaFixture());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SWRConfig value={configSWR}>
        <FormNovaDemanda
          open
          onOpenChange={onOpenChange}
          tipoGestaoInicial={TIPO_GESTAO_UNIDADES.id}
        />
      </SWRConfig>,
    );

    await user.type(screen.getByLabelText(/título/i), "Trocar lâmpada do corredor");
    await user.type(screen.getByLabelText(/descrição/i), "Lâmpada queimada há 2 dias.");
    await user.click(screen.getByRole("button", { name: "Média" }));
    await user.type(screen.getByLabelText(/prazo/i), "2026-12-31");
    await user.click(await screen.findByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    // Simula a autocorreção assíncrona de KanbanBoard.tsx (filtros.tipo_gestao
    // reescrito na URL) acontecendo DEPOIS que o modal já foi aberto e
    // preenchido -- `open` continua `true` o tempo todo, só o valor de
    // `tipoGestaoInicial` muda.
    rerender(
      <SWRConfig value={configSWR}>
        <FormNovaDemanda
          open
          onOpenChange={onOpenChange}
          tipoGestaoInicial={TIPO_GESTAO_UNIDADES.id + 1}
        />
      </SWRConfig>,
    );

    expect(screen.getByLabelText(/título/i)).toHaveValue("Trocar lâmpada do corredor");
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    await waitFor(() => {
      expect(criarDemanda).toHaveBeenCalledWith(
        expect.objectContaining({ unidade: UNIDADE.id }),
      );
    });
    expect(screen.queryByText("Selecione a unidade.")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("FormNovaDemanda -- Coordenação de Unidade só abre demanda pra própria unidade (STC-538)", () => {
  const OUTRA_UNIDADE: Unidade = {
    id: 2,
    nome: "Vitória",
    codigo: "VIT",
    cidade: "Vitória",
    ativa: true,
    rede: "padrao",
  };

  it("Unidade já vem pré-selecionada e sem oferecer outras da rede", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO_UNIDADES]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, OUTRA_UNIDADE]);
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 9, unidade_id: OUTRA_UNIDADE.id, perfil: { id: 3, nome: "Unidade", nivel: 3 } },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    const user = userEvent.setup();
    renderForm();

    expect(
      await screen.findByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent(OUTRA_UNIDADE.nome);
    await user.click(screen.getByLabelText(/^unidade/i));
    expect(
      screen.queryByRole("option", { name: UNIDADE.nome }),
    ).not.toBeInTheDocument();
  });

  // Achado em code review automático: trocar "Tipo de gestão" no meio do
  // preenchimento tenta limpar "unidade" (mutuamente exclusivo com "Área
  // Responsável", handler do Select de tipo de gestão) -- pra Coordenação
  // de Unidade, isso não pode deixar o campo sem valor até ela reabrir a
  // única opção sozinha. Hoje este teste passaria mesmo sem o fix (o
  // `setValue(nome, undefined)` que dispararia o problema é um no-op nesta
  // versão do react-hook-form, ver STC-539) -- fica como proteção pra não
  // regredir quando a STC-539 corrigir aquele no-op.
  it("a trava da Unidade sobrevive a trocar de Tipo de gestão no meio do preenchimento", async () => {
    const OUTRO_TIPO_UNIDADES: TipoGestao = {
      ...TIPO_GESTAO_UNIDADES,
      id: 4,
      nome: "Outra Gestão de Unidades",
      codigo: "outra-unidades",
    };
    vi.mocked(listarTiposGestao).mockResolvedValue([
      TIPO_GESTAO_UNIDADES,
      OUTRO_TIPO_UNIDADES,
    ]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE, OUTRA_UNIDADE]);
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 9, unidade_id: OUTRA_UNIDADE.id, perfil: { id: 3, nome: "Unidade", nivel: 3 } },
      perfil: { id: 3, nome: "Unidade", nivel: 3 },
      isLoading: false,
      isAdminQG: false,
      isAdminOps: false,
      isCoordenacaoUnidade: true,
    } as never);
    const user = userEvent.setup();
    renderForm();

    expect(
      await screen.findByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent(OUTRA_UNIDADE.nome);

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(
      await screen.findByRole("option", { name: "Outra Gestão de Unidades" }),
    );

    expect(
      screen.getByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent(OUTRA_UNIDADE.nome);
  });
});

describe("FormNovaDemanda -- trocar 'Tipo de gestão' realmente limpa a Unidade (STC-539)", () => {
  const OUTRO_TIPO_UNIDADES: TipoGestao = {
    ...TIPO_GESTAO_UNIDADES,
    id: 5,
    nome: "Outro Tipo de Unidades",
    codigo: "outro-tipo-unidades",
  };

  it("reabrir o Select de Unidade depois de trocar de Tipo de gestão mostra 'Selecionar...', não a unidade antiga", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([
      TIPO_GESTAO_UNIDADES,
      OUTRO_TIPO_UNIDADES,
    ]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Unidades" }));
    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));
    expect(
      screen.getByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent(UNIDADE.nome);

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(
      await screen.findByRole("option", { name: "Outro Tipo de Unidades" }),
    );

    expect(
      screen.getByRole("combobox", { name: /^unidade/i }),
    ).toHaveTextContent("Selecionar...");
  });

  it("submeter sem reescolher a Unidade depois da troca continua bloqueado com 'Selecione a unidade.'", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([
      TIPO_GESTAO_UNIDADES,
      OUTRO_TIPO_UNIDADES,
    ]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Unidades" }));
    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(
      await screen.findByRole("option", { name: "Outro Tipo de Unidades" }),
    );

    await user.type(screen.getByLabelText(/título/i), "x");
    await user.type(screen.getByLabelText(/descrição/i), "y");
    await user.click(screen.getByRole("button", { name: "Média" }));
    await user.type(screen.getByLabelText(/prazo/i), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    expect(await screen.findByText("Selecione a unidade.")).toBeInTheDocument();
    expect(criarDemanda).not.toHaveBeenCalled();
  });
});

describe("FormNovaDemanda -- area_responsavel não sofre do mesmo no-op que 'unidade' (STC-539)", () => {
  // Escopo explícito da STC-539: confirmar se setValue("area_responsavel", [])
  // sofre do mesmo problema de setValue(nome, undefined) achado pra
  // "unidade". Confirmado que não -- um array vazio é um valor definido de
  // verdade (não undefined), então o react-hook-form propaga normalmente.
  it("limpa area_responsavel de verdade ao trocar de tipo e voltar", async () => {
    vi.mocked(listarTiposGestao).mockResolvedValue([TIPO_GESTAO, TIPO_GESTAO_UNIDADES]);
    vi.mocked(listarUnidades).mockResolvedValue([UNIDADE]);
    vi.mocked(criarDemanda).mockResolvedValue(construirDemandaFixture());
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Operacional" }));
    await user.click(await screen.findByLabelText(/área responsável/i));
    await user.click(await screen.findByRole("checkbox", { name: "Gerência" }));

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Unidades" }));
    await user.click(screen.getByLabelText(/^unidade/i));
    await user.click(await screen.findByRole("option", { name: "Niterói" }));

    await user.click(screen.getByLabelText(/tipo de gestão/i));
    await user.click(await screen.findByRole("option", { name: "Operacional" }));

    await user.type(screen.getByLabelText(/título/i), "x");
    await user.type(screen.getByLabelText(/descrição/i), "y");
    await user.click(screen.getByRole("button", { name: "Média" }));
    await user.type(screen.getByLabelText(/prazo/i), "2026-12-31");
    await user.click(await screen.findByLabelText(/área responsável/i));
    await user.click(await screen.findByRole("checkbox", { name: "Processo" }));
    await user.click(screen.getByRole("button", { name: "Criar Demanda" }));

    await waitFor(() => {
      expect(criarDemanda).toHaveBeenCalledWith(
        expect.objectContaining({ area_responsavel: ["processo"] }),
      );
    });
  });
});
