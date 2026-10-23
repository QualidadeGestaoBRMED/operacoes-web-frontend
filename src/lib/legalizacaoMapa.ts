import { ORDEM_CATEGORIA, prazoDocumento } from "./legalizacaoMatriz";
import type {
  CategoriaDocumento,
  DocumentoUnidade,
  StatusDocumento,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";
import type { Unidade } from "@/types";

// Bucket visual de UMA célula do heatmap (unidade × categoria) -- diferente
// de StatusDocumento (7 valores, granularidade de UM documento): a célula
// agrega vários documentos (uma categoria pode ter mais de um tipo de
// documento) e resume no pior caso entre eles. "pendente" não existe em
// StatusDocumento -- é a ausência total de documento cadastrado pra essa
// combinação, não um status de um documento real.
export type BucketCelula =
  | "vencido"
  | "atencao"
  | "andamento"
  | "nao_iniciado"
  | "encerramento"
  | "regular"
  | "pendente";

export interface CelulaMapa {
  bucket: BucketCelula;
  // Quantos documentos estão no bucket reportado (0 quando "pendente" --
  // não existe documento nenhum pra contar).
  contagem: number;
}

// Mesmas cores de COR_STATUS_BADGE (legalizacaoMatriz.ts) onde o bucket
// corresponde 1:1 a um status real (vencido/andamento/encerramento) --
// consistência visual entre Lista e Mapa pro mesmo significado.
export const COR_BUCKET_CELULA: Record<BucketCelula, string> = {
  vencido: "bg-red-600",
  atencao: "bg-amber-700",
  andamento: "bg-cyan-700",
  nao_iniciado: "bg-gray-500",
  encerramento: "bg-purple-600",
  regular: "bg-green-600",
  pendente: "bg-muted",
};

// "atenção" funde dois motivos diferentes (status=protocolado OU prazo
// próximo do vencimento) num rótulo só -- o mockup usa "a vencer"/
// "protocolado" como rótulos distintos por célula, mas decidir qual dos
// dois mostrar exigiria rastrear qual documento específico disparou o
// bucket, não só a contagem. Simplificação deliberada: a cor já comunica
// "mesmo nível de urgência", o rótulo genérico não perde informação
// crítica.
// pendente: "sem documento" (não "pendente") -- decidido em conversa:
// "pendente" sugere algo em aberto que vai ser resolvido, mas ausência de
// documento pode muito bem significar que a unidade nunca vai precisar
// dele (não é uma promessa de que "vai ter"). Mesmo termo neutro que a
// legenda já usava embaixo ("Sem documento cadastrado").
export const LABEL_BUCKET_CELULA: Record<BucketCelula, string> = {
  vencido: "vencido",
  atencao: "atenção",
  andamento: "em andamento",
  nao_iniciado: "não iniciado",
  encerramento: "encerramento",
  regular: "em dia",
  pendente: "sem documento",
};

// Texto completo pra legenda da grade (diferente de LABEL_BUCKET_CELULA,
// que é o rótulo curto dentro da própria célula) -- achado no review
// visual: sem uma legenda na tela, "Atenção" sozinho não deixava óbvio que
// corresponde ao mesmo conceito do card "A vencer / Protocolado" lá em
// cima. Ordem = ordem visual do mockup.
export const ORDEM_LEGENDA_BUCKET: BucketCelula[] = [
  "regular",
  "atencao",
  "andamento",
  "nao_iniciado",
  "vencido",
  "encerramento",
  "pendente",
];

export const LEGENDA_BUCKET_CELULA: Record<BucketCelula, string> = {
  regular: "Tudo em dia",
  atencao: "A vencer / protocolado",
  andamento: "Em andamento",
  nao_iniciado: "Não iniciado",
  vencido: "Tem item vencido",
  encerramento: "Unidade em encerramento",
  pendente: "Sem documento cadastrado",
};

function chaveCelula(unidadeId: number, categoria: CategoriaDocumento): string {
  return `${unidadeId}:${categoria}`;
}

// "a vencer" não é um status real (StatusDocumento não tem esse valor) --
// é calculado por proximidade de validade, mesma lógica de prazoDocumento()
// já usada na Lista. "protocolado" (status real) entra no mesmo bucket
// visual "atenção" do mockup -- os dois representam "precisa de ação em
// breve", só com origem diferente (data vs. status).
export function estaEmAtencao(documento: DocumentoUnidade): boolean {
  return (
    documento.status === "protocolado" ||
    prazoDocumento(documento).urgencia === "proximo"
  );
}

// Prioridade de gravidade -- acontece na ordem em que os ifs abaixo
// checam. unidade_encerramento fica DEPOIS de vencido/atenção/andamento/
// nao_iniciado e ANTES de "regular" -- confirmado com o responsável do
// projeto (achado em code review, STC-379/PR#32, 08/09/2026): mesmo
// espírito de "Não aplicável" (nunca compete com um problema ativo, só
// "vence" quando não sobra nenhum), mas continua com bucket/cor PRÓPRIA
// (roxo, não reaproveita o verde de "regular") -- diferente de
// nao_aplicavel, que conta como regular ("sem problema, não precisa fazer
// nada").
// nao_iniciado NÃO conta como regular -- achado no code review: sem um
// bucket próprio, uma categoria onde nenhum documento foi sequer iniciado
// renderizava ✓ "em dia" na célula, idêntico a uma categoria de verdade
// regularizada (a Lista já distingue nao_iniciado com cor própria,
// COR_STATUS_BADGE em legalizacaoMatriz.ts -- só a agregação do Mapa
// escondia isso).
function calcularCelula(documentos: DocumentoUnidade[]): CelulaMapa {
  if (documentos.length === 0) return { bucket: "pendente", contagem: 0 };

  const vencidos = documentos.filter((d) => d.status === "vencido").length;
  if (vencidos > 0) return { bucket: "vencido", contagem: vencidos };

  const emAtencao = documentos.filter(estaEmAtencao).length;
  if (emAtencao > 0) return { bucket: "atencao", contagem: emAtencao };

  const emAndamento = documentos.filter(
    (d) => d.status === "em_andamento",
  ).length;
  if (emAndamento > 0) return { bucket: "andamento", contagem: emAndamento };

  const naoIniciado = documentos.filter(
    (d) => d.status === "nao_iniciado",
  ).length;
  if (naoIniciado > 0) return { bucket: "nao_iniciado", contagem: naoIniciado };

  const encerramento = documentos.filter(
    (d) => d.status === "unidade_encerramento",
  ).length;
  if (encerramento > 0)
    return { bucket: "encerramento", contagem: encerramento };

  return { bucket: "regular", contagem: documentos.length };
}

// STC-714: clicar numa célula leva à Lista filtrada pelo que ela mostra
// (`?situacao=<bucket>`). Os buckets que são um status real viram o filtro
// Status; "atenção" (status OU prazo) vira o filtro próprio da Lista, com a
// mesma regra de estaEmAtencao. "regular" não filtra: todos os documentos da
// célula estão em dia. "pendente" não tem link (célula sem documento).
const STATUS_DA_SITUACAO: Partial<Record<BucketCelula, StatusDocumento>> = {
  vencido: "vencido",
  andamento: "em_andamento",
  nao_iniciado: "nao_iniciado",
  encerramento: "unidade_encerramento",
};

export const SITUACAO_ATENCAO = "atencao";

export function situacaoNaUrl(bucket: BucketCelula): string | null {
  return bucket === SITUACAO_ATENCAO || Object.hasOwn(STATUS_DA_SITUACAO, bucket)
    ? bucket
    : null;
}

// Valor da URL editável à mão: só os valores conhecidos viram filtro.
export function filtroDaSituacao(valor: string | null): {
  status?: StatusDocumento;
  emAtencao: boolean;
} {
  if (valor === SITUACAO_ATENCAO) return { emAtencao: true };
  if (valor && Object.hasOwn(STATUS_DA_SITUACAO, valor)) {
    return { status: STATUS_DA_SITUACAO[valor as BucketCelula], emAtencao: false };
  }
  return { emAtencao: false };
}

function agruparPorCelula(
  documentos: DocumentoUnidade[],
): Map<string, DocumentoUnidade[]> {
  const grupos = new Map<string, DocumentoUnidade[]>();
  for (const documento of documentos) {
    const chave = chaveCelula(
      documento.unidade.id,
      documento.tipo_documento.categoria,
    );
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(documento);
    else grupos.set(chave, [documento]);
  }
  return grupos;
}

export interface GradeMapa {
  // Linhas = todas as unidades reais (useUnidades(), não só as que têm
  // documento) -- uma unidade sem nenhum documento cadastrado ainda
  // aparece na grade inteira como "pendente", não some da lista.
  unidades: Unidade[];
  // Acesso O(1) por unidade+categoria -- ver chaveCelula().
  celulas: Map<string, CelulaMapa>;
}

export function calcularGradeMapa(
  documentos: DocumentoUnidade[],
  unidades: Unidade[],
): GradeMapa {
  const grupos = agruparPorCelula(documentos);
  const celulas = new Map<string, CelulaMapa>();
  for (const unidade of unidades) {
    for (const categoria of ORDEM_CATEGORIA) {
      const chave = chaveCelula(unidade.id, categoria);
      celulas.set(chave, calcularCelula(grupos.get(chave) ?? []));
    }
  }
  return { unidades, celulas };
}

export function celulaDaGrade(
  grade: GradeMapa,
  unidadeId: number,
  categoria: CategoriaDocumento,
): CelulaMapa {
  return (
    grade.celulas.get(chaveCelula(unidadeId, categoria)) ?? {
      bucket: "pendente",
      contagem: 0,
    }
  );
}

export interface ResumoMapa {
  vencidos: { documentos: number; unidades: number };
  aVencer: { documentos: number; unidades: number };
  emAndamento: { documentos: number; unidades: number };
  semPendencia: { unidades: number; total: number };
}

function contarUnidades(documentos: DocumentoUnidade[]): number {
  return new Set(documentos.map((d) => d.unidade.id)).size;
}

// "Sem pendência" (card) != "pendente" (bucket de célula) -- unidade sem
// pendência é a que não tem NENHUMA célula em vencido/atenção/andamento/
// nao_iniciado/encerramento, mesmo que tenha células "pendente". Decisão
// de produto (não é ambiguidade técnica, foi discutida e revertida uma
// vez): "pendente" (nenhum DocumentoUnidade cadastrado pra essa categoria
// nessa unidade) não implica "essa unidade precisa desse documento" --
// exigir que toda unidade marque explicitamente `nao_aplicavel` pra cada
// categoria que não usa, só pra diferenciar de "ainda não cadastrou", não
// é realista. "pendente" fica neutro pro card: nem soma, nem subtrai
// pendência.
function unidadeSemPendencia(grade: GradeMapa, unidade: Unidade): boolean {
  return ORDEM_CATEGORIA.every((categoria) => {
    const { bucket } = celulaDaGrade(grade, unidade.id, categoria);
    return bucket === "regular" || bucket === "pendente";
  });
}

export function calcularResumoMapa(
  documentos: DocumentoUnidade[],
  grade: GradeMapa,
): ResumoMapa {
  const vencidosDocs = documentos.filter((d) => d.status === "vencido");
  // status !== "vencido": mesma prioridade exclusiva de calcularCelula
  // (vencido > atenção) -- achado no code review: status e validade são
  // campos independentes (nada no front garante que "vencido" sempre
  // implica validade no passado -- ex. a movimentação profissional,
  // planejada na STC-370, muda o status pra Vencido só por causa de saída
  // de profissional, sem tocar em validade). Sem a exclusão, um documento
  // vencido com validade ainda dentro dos 15 dias contava em "Vencidos" E
  // em "A vencer" ao mesmo tempo.
  const aVencerDocs = documentos.filter(
    (d) => d.status !== "vencido" && estaEmAtencao(d),
  );
  // !estaEmAtencao: mesma prioridade exclusiva de calcularCelula (vencido >
  // atenção > andamento) -- sem isso, um documento em_andamento com prazo
  // também próximo do vencimento contava em dois cards ao mesmo tempo
  // ("Em andamento" e "A vencer"), embora a célula do heatmap já escolha só
  // um bucket pra ele (atenção, que tem prioridade maior).
  const andamentoDocs = documentos.filter(
    (d) => d.status === "em_andamento" && !estaEmAtencao(d),
  );
  const semPendencia = grade.unidades.filter((unidade) =>
    unidadeSemPendencia(grade, unidade),
  ).length;

  return {
    vencidos: {
      documentos: vencidosDocs.length,
      unidades: contarUnidades(vencidosDocs),
    },
    aVencer: {
      documentos: aVencerDocs.length,
      unidades: contarUnidades(aVencerDocs),
    },
    emAndamento: {
      documentos: andamentoDocs.length,
      unidades: contarUnidades(andamentoDocs),
    },
    semPendencia: { unidades: semPendencia, total: grade.unidades.length },
  };
}

// --- Checklist da célula (STC-866) ---------------------------------------
// O que existe no catálogo para a categoria e o que a unidade já cadastrou.
// Regra da Legalização (23/10/2026): na rede própria, todo tipo do catálogo
// se aplica a todas as unidades; a exceção é o documento Não aplicável.

export type SituacaoNoChecklist = "falta" | "cadastrado" | "nao_aplica";

export interface ItemDoChecklist {
  tipoId: number;
  nome: string;
  situacao: SituacaoNoChecklist;
  /** Documentos cadastrados do tipo (mais de um nos tipos com instâncias). */
  quantidade: number;
}

export interface ChecklistDaCelula {
  itens: ItemDoChecklist[];
  cadastrados: number;
  /** Tipos da categoria que se aplicam à unidade (sem os Não aplicável). */
  aplicaveis: number;
}

/** Documentos por unidade e tipo: quantos cadastrados e se há Não aplicável. */
export type IndiceDoChecklist = Map<string, { cadastrados: number; naoAplicavel: boolean }>;

export function indiceDoChecklist(documentos: DocumentoUnidade[]): IndiceDoChecklist {
  const indice: IndiceDoChecklist = new Map();
  for (const documento of documentos) {
    const chave = `${documento.unidade.id}:${documento.tipo_documento.id}`;
    const atual = indice.get(chave) ?? { cadastrados: 0, naoAplicavel: false };
    if (documento.status === "nao_aplicavel") atual.naoAplicavel = true;
    else atual.cadastrados += 1;
    indice.set(chave, atual);
  }
  return indice;
}

const ORDEM_SITUACAO: Record<SituacaoNoChecklist, number> = {
  falta: 0,
  cadastrado: 1,
  nao_aplica: 2,
};

export function checklistDaCelula(
  indice: IndiceDoChecklist,
  tipos: TipoDocumentoRegulatorio[],
  unidadeId: number,
  categoria: CategoriaDocumento,
): ChecklistDaCelula {
  const itens = tipos
    .filter((tipo) => tipo.ativo && tipo.categoria === categoria)
    .map((tipo): ItemDoChecklist => {
      const registro = indice.get(`${unidadeId}:${tipo.id}`);
      // Um documento cadastrado vale mais que um Não aplicável do mesmo tipo.
      const situacao: SituacaoNoChecklist = registro?.cadastrados
        ? "cadastrado"
        : registro?.naoAplicavel
          ? "nao_aplica"
          : "falta";
      return { tipoId: tipo.id, nome: tipo.nome, situacao, quantidade: registro?.cadastrados ?? 0 };
    })
    .sort(
      (a, b) =>
        ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  return {
    itens,
    cadastrados: itens.filter((item) => item.situacao === "cadastrado").length,
    aplicaveis: itens.filter((item) => item.situacao !== "nao_aplica").length,
  };
}

/**
 * "2 de 5 cadastrados"; no singular quando o total é 1 ("1 de 1 cadastrado").
 * Categoria com todos os tipos Não aplicável: "Nenhum se aplica a esta unidade".
 * Mesmo texto na dica e no nome acessível da célula.
 */
export function textoDeCadastrados({ itens, cadastrados, aplicaveis }: ChecklistDaCelula): string {
  if (aplicaveis === 0 && itens.length > 0) return "Nenhum se aplica a esta unidade";
  return `${cadastrados} de ${aplicaveis} ${aplicaveis === 1 ? "cadastrado" : "cadastrados"}`;
}

/** Parte dos tipos que se aplicam já cadastrada, em % inteiro; null se nenhum se aplica. */
export function percentualCadastrado({ cadastrados, aplicaveis }: ChecklistDaCelula): number | null {
  return aplicaveis === 0 ? null : Math.round((cadastrados / aplicaveis) * 100);
}
