import { describe, expect, it } from "vitest";
import type { Demanda, DemandaResponsavel, StatusDemanda } from "@/types";
import { compararDemandas, filtrosDaUrl, mensagemBloqueioConhecido, passaNoFoco } from "./kanban";

let proximoId = 1;

function criarDemanda(overrides: Partial<Demanda> = {}): Demanda {
  const id = proximoId++;
  return {
    id,
    titulo: `Demanda ${id}`,
    descricao: "",
    tipo_gestao: { id: 1, modulo: 1, nome: "Operacional", codigo: "operacional", descricao: "", visibilidade_padrao: "todos", ativo: true, ordem: 0 },
    prioridade: "media",
    status: "backlog",
    unidade: { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true },
    setor: null,
    categoria: null,
    solicitante: {
      id: 1,
      username: "solicitante",
      email: "solicitante@grupobrmed.com.br",
      first_name: "",
      last_name: "",
      perfil: null,
      unidade_id: 1,
      setor_id: null,
      ativo: true,
      ultimo_acesso: null,
    },
    aprovador: null,
    responsaveis: [],
    etiquetas: [],
    data_prevista: "2026-07-20",
    data_conclusao: null,
    confidencial: false,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

function responsavelPrincipal(): DemandaResponsavel {
  return {
    id: 1,
    tipo: "principal",
    usuario: {
      id: 2,
      username: "responsavel",
      email: "responsavel@grupobrmed.com.br",
      first_name: "Responsável",
      last_name: "Um",
      perfil: null,
      unidade_id: 1,
      setor_id: null,
      ativo: true,
      ultimo_acesso: null,
    },
  };
}

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
    expect(mensagemBloqueioConhecido(demanda, "em_andamento")).toBe(
      "Defina um responsável principal antes de iniciar a execução.",
    );
  });

  it("permite backlog -> em_andamento com responsável principal definido", () => {
    const demanda = criarDemanda({ status: "backlog", responsaveis: [responsavelPrincipal()] });
    expect(mensagemBloqueioConhecido(demanda, "em_andamento")).toBeNull();
  });

  it("bloqueia em_andamento -> em_revisao (exige aprovador, não coletado no drag)", () => {
    const demanda = criarDemanda({ status: "em_andamento" });
    expect(mensagemBloqueioConhecido(demanda, "em_revisao")).toBe(
      "Selecione um aprovador para enviar à revisão.",
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
    expect(mensagemBloqueioConhecido(demanda, novoStatus)).toBe(
      "Justificativa obrigatória para essa transição.",
    );
  });

  it("não bloqueia transições sem regra especial (ex.: backlog -> lixeira via card normal)", () => {
    const demanda = criarDemanda({ status: "em_andamento", responsaveis: [responsavelPrincipal()] });
    expect(mensagemBloqueioConhecido(demanda, "lixeira")).toBeNull();
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
});
