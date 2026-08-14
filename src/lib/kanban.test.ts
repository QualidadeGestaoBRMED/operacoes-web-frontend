import { describe, expect, it } from "vitest";
import type { StatusDemanda } from "@/types";
import { criarDemanda, responsavelPrincipal } from "@/test-utils/fixtures";
import {
  compararDemandas,
  filtrosDaUrl,
  mensagemBloqueioConhecido,
  passaNoFoco,
  secaoDoBloqueio,
} from "./kanban";

describe("compararDemandas", () => {
  it("ordena por prazo mais próximo primeiro", () => {
    const maisTarde = criarDemanda({ data_prevista: "2026-08-01" });
    const maisCedo = criarDemanda({ data_prevista: "2026-07-15" });
    expect([maisTarde, maisCedo].sort(compararDemandas)).toEqual([maisCedo, maisTarde]);
  });

  it("desempata por prioridade quando o prazo é igual (urgente > alta > média > baixa)", () => {
    const baixa = criarDemanda({ data_prevista: "2026-07-20", prioridade: "baixa" });
    const urgente = criarDemanda({ data_prevista: "2026-07-20", prioridade: "urgente" });
    const media = criarDemanda({ data_prevista: "2026-07-20", prioridade: "media" });
    expect([baixa, urgente, media].sort(compararDemandas)).toEqual([urgente, media, baixa]);
  });
});

describe("mensagemBloqueioConhecido", () => {
  it("bloqueia backlog -> em_andamento sem responsável principal", () => {
    const demanda = criarDemanda({ status: "backlog", responsaveis: [] });
    expect(mensagemBloqueioConhecido(demanda, "em_andamento", true, undefined)).toBe(
      "Defina um responsável principal antes de iniciar a execução.",
    );
  });

  it("permite backlog -> em_andamento com responsável principal definido", () => {
    const demanda = criarDemanda({ status: "backlog", responsaveis: [responsavelPrincipal()] });
    expect(mensagemBloqueioConhecido(demanda, "em_andamento", true, undefined)).toBeNull();
  });

  it("bloqueia em_andamento -> em_revisao (exige aprovador, não coletado no drag)", () => {
    const demanda = criarDemanda({ status: "em_andamento" });
    expect(mensagemBloqueioConhecido(demanda, "em_revisao", true, undefined)).toBe(
      'Selecione um aprovador para enviar à revisão -- abra a demanda e use "Mudar status".',
    );
  });

  it.each<[StatusDemanda, StatusDemanda]>([
    ["em_andamento", "backlog"],
    ["em_revisao", "em_andamento"],
    ["em_revisao", "backlog"],
    ["concluido", "em_andamento"],
    ["concluido", "backlog"],
  ])("bloqueia %s -> %s (exige justificativa, não coletada no drag)", (statusAtual, novoStatus) => {
    const demanda = criarDemanda({ status: statusAtual });
    expect(mensagemBloqueioConhecido(demanda, novoStatus, true, undefined)).toBe(
      'Justificativa obrigatória para essa transição -- abra a demanda e use "Mudar status".',
    );
  });

  it("não bloqueia transições sem regra especial (ex.: backlog -> lixeira via card normal)", () => {
    const demanda = criarDemanda({ status: "em_andamento", responsaveis: [responsavelPrincipal()] });
    expect(mensagemBloqueioConhecido(demanda, "lixeira", true, undefined)).toBeNull();
  });

  // Achado no review do STC-203: sem checar permissão, um usuário comum
  // arrastando em_revisao -> em_andamento (decisão exclusiva de
  // aprovador/admin) caía na regra de "justificativa obrigatória" e era
  // instruído a usar "Mudar status" -- opção que TransicaoStatusSection
  // nem mostra pra ele (filtra pelo mesmo critério de permissão).
  it("bloqueia por falta de permissão antes de checar justificativa/aprovador", () => {
    const demanda = criarDemanda({ status: "em_revisao", aprovador: null });
    expect(mensagemBloqueioConhecido(demanda, "em_andamento", false, 99)).toBe(
      "Você não tem permissão para fazer essa transição.",
    );
  });

  it("libera o aprovador designado, mesmo sem ser admin", () => {
    const demanda = criarDemanda({
      status: "em_revisao",
      aprovador: { id: 42, username: "aprov", email: "a@grupobrmed.com.br", first_name: "", last_name: "", perfil: null, unidade_id: 1, setor_id: null, ativo: true, ultimo_acesso: null, foto_url: "" },
    });
    expect(mensagemBloqueioConhecido(demanda, "em_andamento", false, 42)).toBe(
      'Justificativa obrigatória para essa transição -- abra a demanda e use "Mudar status".',
    );
  });

  // "Concluir sem revisão" (pedido direto do responsável do projeto): admin
  // libera em_andamento -> concluido direto, sem aprovador nem justificativa.
  it("libera em_andamento -> concluido pra admin, sem exigir aprovador/justificativa", () => {
    const demanda = criarDemanda({ status: "em_andamento" });
    expect(mensagemBloqueioConhecido(demanda, "concluido", true, undefined)).toBeNull();
  });

  it("bloqueia em_andamento -> concluido por falta de permissão pra quem não é admin", () => {
    const demanda = criarDemanda({ status: "em_andamento" });
    expect(mensagemBloqueioConhecido(demanda, "concluido", false, 99)).toBe(
      "Você não tem permissão para fazer essa transição.",
    );
  });

  // Achado em autorevisão: usuarioTemPermissaoParaTransicao (usada por
  // bloqueioDetalhado) só sabe negar pares que ESTÃO em algum dos sets de
  // permissão -- um par que não é uma transição válida pra começo de
  // conversa (backlog -> concluido "pula tudo") não estava em nenhum deles,
  // então passava sem bloqueio nenhum antes dessa checagem existir.
  it("bloqueia uma transição que não existe (backlog -> concluido, 'pula tudo')", () => {
    const demanda = criarDemanda({ status: "backlog" });
    expect(mensagemBloqueioConhecido(demanda, "concluido", true, undefined)).toBe(
      'Não é possível mover de "Backlog" para "Concluído".',
    );
  });

  it("não bloqueia mover pra lixeira mesmo não estando em nenhum TRANSICOES_PERMITIDAS (soft-delete, não é transição de status)", () => {
    const demanda = criarDemanda({ status: "em_andamento", responsaveis: [responsavelPrincipal()] });
    expect(mensagemBloqueioConhecido(demanda, "lixeira", true, undefined)).toBeNull();
  });
});

describe("secaoDoBloqueio", () => {
  // STC-203: mesmas transições já cobertas acima, mas verificando qual
  // seção do DetalheCard cada bloqueio deve abrir automaticamente.
  it("aponta pra 'responsavel' quando falta responsável principal", () => {
    const demanda = criarDemanda({ status: "backlog", responsaveis: [] });
    expect(secaoDoBloqueio(demanda, "em_andamento", true, undefined)).toBe("responsavel");
  });

  it("aponta pra 'status' quando falta aprovador", () => {
    const demanda = criarDemanda({ status: "em_andamento" });
    expect(secaoDoBloqueio(demanda, "em_revisao", true, undefined)).toBe("status");
  });

  it.each<[StatusDemanda, StatusDemanda]>([
    ["em_andamento", "backlog"],
    ["em_revisao", "em_andamento"],
    ["em_revisao", "backlog"],
    ["concluido", "em_andamento"],
    ["concluido", "backlog"],
  ])("aponta pra 'status' quando %s -> %s exige justificativa", (statusAtual, novoStatus) => {
    const demanda = criarDemanda({ status: statusAtual });
    expect(secaoDoBloqueio(demanda, novoStatus, true, undefined)).toBe("status");
  });

  it("não aponta seção nenhuma sem bloqueio conhecido", () => {
    const demanda = criarDemanda({ status: "em_andamento", responsaveis: [responsavelPrincipal()] });
    expect(secaoDoBloqueio(demanda, "lixeira", true, undefined)).toBeNull();
  });

  // Achado no review: abrir "status" pra um bloqueio de permissão seria
  // mandar o usuário pra uma opção que TransicaoStatusSection nem mostra.
  it("não aponta seção nenhuma quando o bloqueio é falta de permissão", () => {
    const demanda = criarDemanda({ status: "em_revisao", aprovador: null });
    expect(secaoDoBloqueio(demanda, "em_andamento", false, 99)).toBeNull();
  });
});

describe("passaNoFoco", () => {
  it("sem foco ativo, deixa passar qualquer demanda", () => {
    expect(passaNoFoco(criarDemanda(), null)).toBe(true);
  });

  it("com foco, sempre exclui demandas concluídas", () => {
    const demanda = criarDemanda({ status: "concluido", data_prevista: "2020-01-01" });
    expect(passaNoFoco(demanda, "atrasadas")).toBe(false);
  });

  it("'atrasadas': só passa quando o prazo já venceu", () => {
    const atrasada = criarDemanda({ data_prevista: "2020-01-01" });
    const noPrazo = criarDemanda({ data_prevista: "2099-01-01" });
    expect(passaNoFoco(atrasada, "atrasadas")).toBe(true);
    expect(passaNoFoco(noPrazo, "atrasadas")).toBe(false);
  });

  it("'sem responsável': só passa quando não há responsável principal", () => {
    const semPrincipal = criarDemanda({ responsaveis: [] });
    const comPrincipal = criarDemanda({ responsaveis: [responsavelPrincipal()] });
    expect(passaNoFoco(semPrincipal, "sem responsável")).toBe(true);
    expect(passaNoFoco(comPrincipal, "sem responsável")).toBe(false);
  });

  it("'em andamento': só passa quando o status é 'em_andamento'", () => {
    const emAndamento = criarDemanda({ status: "em_andamento" });
    const backlog = criarDemanda({ status: "backlog" });
    expect(passaNoFoco(emAndamento, "em andamento")).toBe(true);
    expect(passaNoFoco(backlog, "em andamento")).toBe(false);
  });
});

describe("filtrosDaUrl", () => {
  it("lê unidade, prioridade, categoria e busca da URL", () => {
    const params = new URLSearchParams("unidade=3&prioridade=urgente&categoria=2&search=pop");
    expect(filtrosDaUrl(params)).toEqual({
      unidade: 3,
      prioridade: "urgente",
      categoria: 2,
      search: "pop",
    });
  });

  it("devolve objeto vazio sem nenhum parâmetro", () => {
    expect(filtrosDaUrl(new URLSearchParams())).toEqual({});
  });

  // Achado testando localmente: area_responsavel era escrito na URL mas
  // nunca lido de volta -- o filtro do Kanban nunca aplicava de fato,
  // mesmo a opção selecionada aparecendo marcada no Select.
  it("lê area_responsavel da URL", () => {
    const params = new URLSearchParams("area_responsavel=processo");
    expect(filtrosDaUrl(params)).toEqual({ area_responsavel: "processo" });
  });
});
