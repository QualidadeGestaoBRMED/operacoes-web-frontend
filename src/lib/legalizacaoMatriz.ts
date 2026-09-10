import {
  ordenarPor,
  type ExtratoresDeChave,
  type Ordenacao as OrdenacaoGenerica,
} from "./ordenacao";
import { nomeExibicao } from "./utils";
import type {
  CategoriaDocumento,
  Criticidade,
  DocumentoUnidade,
  ResponsavelDocumento,
  StatusDocumento,
} from "@/types/legalizacao";

// Mesmo raciocínio de CODIGO_TIPO_DOCUMENTO_DOSIMETRIA (backend, RN12) --
// sem flag estrutural pra "este tipo aceita movimentação profissional",
// código fixo do catálogo seed (RN11). CRM/RT tem 2 códigos hoje (CREMERJ/
// COREN, ver seed_catalogo_legalizacao.py); se novos conselhos profissionais
// forem cadastrados no catálogo (ex. biomedicina, citado no Plano de Ação),
// este conjunto precisa crescer junto -- não é um campo estrutural real.
// Vive aqui (não em DetalheDocumentoModal.tsx nem em
// MovimentacaoProfissionalModal.tsx) porque os dois componentes precisam
// do mesmo conjunto -- um pra decidir quando o botão aparece, o outro pra
// popular o checklist "Documentos afetados nesta unidade" (STC-382) --
// e um import cruzado entre os dois criaria uma dependência circular.
export const CODIGOS_MOVIMENTACAO_PROFISSIONAL = new Set([
  "cnes",
  "dosimetria",
  "registro-cremerj",
  "registro-coren",
]);

// Único lugar que decide "quem é o responsável exibido/usado pra ordenar"
// -- achado no code review: MatrizTable.tsx reimplementava essa mesma regra
// (principal, com fallback pro primeiro) separada da chave de ordenação
// abaixo; uma mudança na regra (ex.: desempate entre dois principais) só
// seria aplicada num dos dois lugares.
export function responsavelPrincipal(
  documento: DocumentoUnidade,
): ResponsavelDocumento | undefined {
  return (
    documento.responsaveis.find((r) => r.principal) ?? documento.responsaveis[0]
  );
}

// Espelha TipoDocumentoRegulatorio.Categoria.labels (backend/legalizacao/
// models.py) -- sem isso, a categoria aparecia crua (ex. "registros_tecnicos")
// como subtítulo do documento na Matriz, em vez do rótulo em português.
export const LABEL_CATEGORIA: Record<CategoriaDocumento, string> = {
  regularizacao: "Regularização e licenciamento",
  registros_tecnicos: "Registros técnicos",
  capacitacao: "Capacitação",
  infraestrutura: "Infraestrutura e sanitário",
  equipamentos: "Equipamentos",
  programas: "Programas obrigatórios",
  residuos: "Resíduos",
};

// Ordem visual do mockup (colunas do heatmap no Mapa, STC-379) -- mesma
// usada no filtro de Categoria da Lista, fonte única pra não ter listas
// divergentes do mesmo conjunto de 7 valores.
export const ORDEM_CATEGORIA: CategoriaDocumento[] = [
  "regularizacao",
  "registros_tecnicos",
  "capacitacao",
  "infraestrutura",
  "equipamentos",
  "programas",
  "residuos",
];

// Mesmo critério de COR_PRIORIDADE (lib/kanban.ts): cores reais de
// severidade via Tailwind puro, não os tokens de marca -- reservados pro
// chrome da UI (sidebar/topbar), não pra indicador de status.
export const COR_STATUS_BADGE: Record<StatusDocumento, string> = {
  regular: "bg-green-600",
  nao_iniciado: "bg-gray-500",
  em_andamento: "bg-cyan-700",
  protocolado: "bg-amber-700",
  vencido: "bg-red-600",
  nao_aplicavel: "bg-muted text-foreground",
  unidade_encerramento: "bg-purple-600",
};

export const LABEL_STATUS: Record<StatusDocumento, string> = {
  regular: "Regular",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  protocolado: "Protocolado",
  vencido: "Vencido",
  nao_aplicavel: "Não aplicável",
  unidade_encerramento: "Unidade em encerramento",
};

// Ordem de fluxo (não alfabética) -- mesma usada no filtro, na legenda e na
// ordenação por coluna "Status", pra não ter 3 listas divergentes pro mesmo
// conjunto de valores.
export const ORDEM_STATUS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
  "nao_aplicavel",
  "unidade_encerramento",
];

export const LABEL_CRITICIDADE: Record<Criticidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

// Só "alta" ganha destaque de cor (mesmo espírito do mockup) -- média/baixa
// ficam com a mesma tag neutra usada pra "sem criticidade" (regra_aplicada
// nulo), pra não competir visualmente com o badge de status, que já é a
// informação principal da linha.
export const COR_CRITICIDADE_ALTA = "border-red-200 bg-red-100 text-red-700";

// Status sem prazo relevante -- documento nasceu "coringa" (justificativa
// no lugar de validade), então não faz sentido calcular urgência de nada.
const STATUS_SEM_PRAZO: ReadonlySet<StatusDocumento> = new Set([
  "nao_aplicavel",
  "unidade_encerramento",
]);

export type UrgenciaPrazo = "vencido" | "proximo" | "normal" | "sem-prazo";

const LIMIAR_PROXIMO_DIAS = 15;

// Dias entre hoje e a validade (negativo = já venceu). null = sem prazo
// relevante (status coringa ou sem validade) -- extraído à parte de
// prazoDocumento() porque a ordenação por coluna "Prazo" precisa do valor
// numérico bruto, não do texto formatado.
export function diasParaPrazo(documento: DocumentoUnidade): number | null {
  if (STATUS_SEM_PRAZO.has(documento.status) || !documento.validade)
    return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(`${documento.validade}T00:00:00`);
  return Math.round((validade.getTime() - hoje.getTime()) / 86_400_000);
}

// Calculado no navegador de propósito -- o backend não expõe um "prazo
// formatado" (achado ao comparar com o PLANEJAMENTO_LEGALIZACAO.md solto na
// raiz do repo, que propunha um campo assim sem ele existir em nenhum
// serializer real). Só usa validade + status, os únicos campos reais
// disponíveis em DocumentoUnidade -- não tenta replicar os textos
// contextuais do mockup (ex. "protocolo em análise", "janela abre em X
// dias") que dependeriam de dados que este endpoint não devolve
// (ProcessoRenovacao, janela RN13, movimentação profissional).
export function prazoDocumento(documento: DocumentoUnidade): {
  texto: string;
  urgencia: UrgenciaPrazo;
} {
  const dias = diasParaPrazo(documento);
  if (dias === null) return { texto: "—", urgencia: "sem-prazo" };

  if (dias < 0) {
    const diasAtraso = Math.abs(dias);
    return {
      texto: `vencido há ${diasAtraso} dia${diasAtraso === 1 ? "" : "s"}`,
      urgencia: "vencido",
    };
  }
  if (dias === 0) return { texto: "vence hoje", urgencia: "proximo" };
  return {
    texto: `em ${dias} dia${dias === 1 ? "" : "s"}`,
    urgencia: dias <= LIMIAR_PROXIMO_DIAS ? "proximo" : "normal",
  };
}

export type CampoOrdenavel =
  "unidade" | "documento" | "status" | "responsavel" | "criticidade" | "prazo";

// Reexportado com o nome que os componentes já usavam (MatrizTable.tsx,
// MatrizConformidade.tsx) -- a extração pro motor genérico (lib/ordenacao.ts)
// não muda a API pública deste módulo.
export type Ordenacao = OrdenacaoGenerica<CampoOrdenavel>;

const ORDEM_CRITICIDADE: Record<Criticidade, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

// Cada campo extrai uma chave comparável (string/number) ou null quando o
// documento não tem valor pra esse campo (sem responsável, sem criticidade,
// sem prazo) -- null sempre vai pro final, nas duas direções (ver
// ordenarPor() em lib/ordenacao.ts).
const CHAVES: ExtratoresDeChave<DocumentoUnidade, CampoOrdenavel> = {
  unidade: (d) => d.unidade.nome,
  documento: (d) => d.tipo_documento.nome,
  // indexOf() devolve -1 (não undefined) quando não acha -- achado no code
  // review: sem o fallback pra null, um status novo no backend que ainda
  // não tivesse entrado em ORDEM_STATUS ordenaria PRIMEIRO (-1 < 0) em vez
  // de ir pro final, como todo outro campo sem valor já faz aqui.
  status: (d) => {
    const indice = ORDEM_STATUS.indexOf(d.status);
    return indice === -1 ? null : indice;
  },
  responsavel: (d) => {
    const principal = responsavelPrincipal(d);
    return principal ? nomeExibicao(principal.usuario) : null;
  },
  criticidade: (d) => {
    const criticidade = d.regra_aplicada?.criticidade;
    return criticidade ? ORDEM_CRITICIDADE[criticidade] : null;
  },
  prazo: (d) => diasParaPrazo(d),
};

export function ordenarDocumentos(
  documentos: DocumentoUnidade[],
  ordenacao: Ordenacao | null,
): DocumentoUnidade[] {
  return ordenarPor(documentos, ordenacao, CHAVES);
}

// Busca no navegador sobre a lista já carregada (não uma chamada nova à
// API) -- DocumentoUnidadeViewSet não tem SearchFilter, e a lista não é
// paginada (catálogo de tamanho fixo, documento × unidade), então filtrar
// no client é suficiente e não fica obsoleto com o crescimento dos dados.
export function documentoBateNaBusca(
  documento: DocumentoUnidade,
  busca: string,
): boolean {
  const alvo = busca.trim().toLowerCase();
  if (!alvo) return true;
  return (
    documento.unidade.nome.toLowerCase().includes(alvo) ||
    documento.tipo_documento.nome.toLowerCase().includes(alvo)
  );
}

// Mesmo motivo de documentoBateNaBusca -- "categoria" não existe no
// DocumentoUnidadeFilterSet real (STC-379), filtrado no navegador sobre a
// lista já carregada. undefined = sem filtro, bate com tudo.
export function documentoBateNaCategoria(
  documento: DocumentoUnidade,
  categoria: CategoriaDocumento | undefined,
): boolean {
  if (!categoria) return true;
  return documento.tipo_documento.categoria === categoria;
}
