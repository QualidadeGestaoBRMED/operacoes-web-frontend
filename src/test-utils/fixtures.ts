import type { Demanda, DemandaResponsavel } from "@/types";

// Compartilhado entre kanban.test.ts e os testes de componente (STC-171) --
// evita duplicar/divergir o mesmo "objeto Demanda realista" em vários
// arquivos. proximoId reseta a cada arquivo de teste (vitest isola o
// registro de módulos por arquivo), então não há contaminação entre specs.
let proximoId = 1;

export function criarDemanda(overrides: Partial<Demanda> = {}): Demanda {
  const id = proximoId++;
  return {
    id,
    titulo: `Demanda ${id}`,
    descricao: "",
    tipo_gestao: {
      id: 1,
      modulo: 1,
      nome: "Operacional",
      codigo: "operacional",
      descricao: "",
      visibilidade_padrao: "todos",
      ativo: true,
      ordem: 0,
    },
    prioridade: "media",
    status: "backlog",
    unidade: { id: 1, nome: "Niterói", codigo: "NIT", cidade: "Niterói", ativa: true },
    area_responsavel: null,
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
      foto_url: "",
    },
    aprovador: null,
    responsaveis: [],
    etiquetas: [],
    data_prevista: "2026-07-20",
    data_conclusao: null,
    confidencial: false,
    comentarios_count: 0,
    anexos_count: 0,
    pode_editar: false,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

export function responsavelPrincipal(): DemandaResponsavel {
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
      foto_url: "",
    },
  };
}
