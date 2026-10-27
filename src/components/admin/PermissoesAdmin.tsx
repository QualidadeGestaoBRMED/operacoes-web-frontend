"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ListFilter,
  Maximize2,
  Minimize2,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAlturaSemLinhaCortada } from "@/hooks/useAlturaSemLinhaCortada";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { encontrarRecursoPorChave, useRecursosPermissao } from "@/hooks/useModulos";
import {
  usePermissoes,
  useReativarPermissao,
  useRevogarPermissao,
} from "@/hooks/usePermissoes";
import { useSetores } from "@/hooks/useSetores";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { hojeNoFusoDoServidor } from "@/lib/kanban";
import { ordenarPor, proximaOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import { ROTULO_REDE } from "@/lib/redes";
import { cn, formatarDataHora, nomeExibicao } from "@/lib/utils";
import type { AcaoPermissao, EscopoPermissao, PermissaoUsuario } from "@/types";
import {
  FormNovaPermissao,
  type ValoresIniciaisPermissao,
} from "./FormNovaPermissao";
import { AcessosAdmin } from "./AcessosAdmin";
import { GerenciarUsuarios, usuariosGerenciaveis } from "./GerenciarUsuarios";
import { ParametrosGestaoRHAdmin } from "./gestao-rh/ParametrosGestaoRHAdmin";
import { CatalogoLegalizacaoAdmin } from "./legalizacao/CatalogoLegalizacaoAdmin";

const STATUS_PERMISSAO = ["Ativa", "Agendada", "Expirada", "Revogada"] as const;

type Secao = "usuarios" | "permissoes";

type CampoPermissoes = "pessoa" | "recurso" | "concedido" | "acao" | "escopo" | "periodo" | "status";

const COLUNAS_PERMISSOES: { campo: CampoPermissoes; rotulo: string }[] = [
  { campo: "pessoa", rotulo: "Pessoa" },
  { campo: "recurso", rotulo: "Recurso" },
  { campo: "concedido", rotulo: "Concedido" },
  { campo: "acao", rotulo: "Ação" },
  { campo: "escopo", rotulo: "Escopo" },
  { campo: "periodo", rotulo: "Período" },
  { campo: "status", rotulo: "Status" },
];
type Aba = "usuarios" | "acessos" | "catalogo-legalizacao" | "parametros-gestao-rh";

const ROTULO_ABA: Record<Aba, string> = {
  usuarios: "Usuários",
  acessos: "Acessos",
  "catalogo-legalizacao": "Catálogo de Legalização",
  "parametros-gestao-rh": "Parâmetros de Gestão RH",
};

const ROTA_ABA: Record<Aba, string> = {
  usuarios: "/admin/permissoes",
  acessos: "/admin/permissoes/acessos",
  "catalogo-legalizacao": "/admin/permissoes/catalogo-legalizacao",
  "parametros-gestao-rh": "/admin/permissoes/parametros-gestao-rh",
};

// Achado no dogfooding: 50/50 fixo desperdiçava espaço quando uma seção
// tinha poucas linhas e a outra, mais -- em vez de flex-1 igual pras duas,
// o "peso" (flex-grow) de cada seção acompanha quantas linhas ela realmente
// tem. PESO_MINIMO evita que uma seção vazia suma; PESO_MAXIMO evita que uma
// tabela enorme empurre a outra pra quase nada.
const PESO_MINIMO = 1;
const PESO_MAXIMO = 6;

function pesoSecao(linhas: number) {
  return Math.min(Math.max(linhas, PESO_MINIMO), PESO_MAXIMO);
}

const ROTULO_ACAO: Record<AcaoPermissao, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  aprovar: "Aprovar",
  excluir: "Excluir",
  restaurar: "Restaurar",
  configurar: "Configurar",
};

const ROTULO_ESCOPO: Record<EscopoPermissao, string> = {
  global: "Global",
  unidade: "Unidade",
  setor: "Setor",
  proprio: "Próprio",
};

function formatarData(data: string) {
  // "YYYY-MM-DD" (DateField do Django) formatado sem passar por Date --
  // new Date("2026-03-05") interpreta como UTC meia-noite, que em fusos a
  // oeste de UTC (todo o Brasil) exibe o dia ANTERIOR ao real.
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Espelha PermissaoUsuarioManager.ativas() (backend/plataforma/models.py):
// ativo=True, data_inicio já chegou, e (sem data_fim OU data_fim ainda não
// passou). "Agendada" (data_inicio no futuro) é um estado que o manager do
// backend também exclui de ativas() -- listado à parte aqui só pra UI não
// confundir "nunca vai valer" com "ainda não começou". Assinatura aceita um
// subconjunto de campos (em vez de PermissaoUsuario inteiro) pra servir tanto
// uma linha individual de PermissaoUsuario.
function statusPermissao(permissao: {
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
}): {
  rotulo: string;
  variante: "success" | "warning" | "muted" | "destructive";
} {
  if (!permissao.ativo) return { rotulo: "Revogada", variante: "destructive" };
  const dataAtual = hojeNoFusoDoServidor();
  if (permissao.data_inicio > dataAtual)
    return { rotulo: "Agendada", variante: "warning" };
  if (permissao.data_fim && permissao.data_fim < dataAtual) {
    return { rotulo: "Expirada", variante: "muted" };
  }
  return { rotulo: "Ativa", variante: "success" };
}

// Reaproveita a ordem já estabelecida em STATUS_PERMISSAO (a mesma do
// filtro) em vez de duplicar a lista -- Agendada entra logo depois de
// Ativa (ainda vai valer, só não começou), não foi pedido explicitamente
// mas segue a mesma lógica "o que importa agora primeiro".
function prioridadeStatus(permissao: {
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
}) {
  return (STATUS_PERMISSAO as readonly string[]).indexOf(
    statusPermissao(permissao).rotulo,
  );
}

export function PermissoesAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    isAdminOps,
    administraRedePadrao,
    isCoordenacaoUnidade,
    isSetorLeg,
    isLoading: carregandoAuth,
    confirmandoCargo,
  } = useAuth();
  // STC-514: Coordenador (nível 3) ganha acesso, mas só ao Catálogo de
  // Legalização -- Usuários/Permissões individuais continuam Admin-only.
  // STC-521: Setor de Legalização (nível 4, setor.codigo === "LEG") ganha o
  // mesmo acesso restrito, pelo mesmo motivo -- já pode escrever no catálogo
  // pela API (PodeEscreverCatalogoLegalizacao), faltava só o caminho na tela.
  // Mutuamente exclusivo com isAdminOps na prática (níveis diferentes),
  // mas checado explícito mesmo assim: se algum dia alguém acumular os
  // dois papéis, Admin Ops deve prevalecer (acesso completo).
  const apenasCatalogo = (isCoordenacaoUnidade || isSetorLeg) && !isAdminOps;
  const podeAcessar = isAdminOps || isCoordenacaoUnidade || isSetorLeg;
  // STC-747: Catálogo de Legalização e Parâmetros de Gestão RH são
  // configuração da rede padrão; o Admin Operações Especiais fica com
  // Usuários e Acessos (os da rede dele, STC-746).
  const abasPermitidas: Aba[] = apenasCatalogo
    ? ["catalogo-legalizacao"]
    : administraRedePadrao
      ? ["usuarios", "acessos", "catalogo-legalizacao", "parametros-gestao-rh"]
      : ["usuarios", "acessos"];
  // Mesmo critério do KanbanFiltros (STC-186): abaixo de 640px, os selects
  // de filtro saem de linha e vão pra dentro de um Popover atrás de um
  // botão só, com badge de contagem -- evita empilhar campo atrás de campo
  // antes do usuário ver qualquer linha da tabela.
  const ehMobile = useMediaQuery("(max-width: 639px)");
  const {
    refPai: refSecaoPermissoes,
    refTabela: refTabelaPermissoes,
    maxHeight: alturaTabelaPermissoes,
  } = useAlturaSemLinhaCortada();
  // Só Admin Operações lê as permissões; Coordenação e Setor de Legalização
  // chegam aqui só pelo Catálogo.
  const { permissoes, isLoading: carregandoPermissoes } = usePermissoes(isAdminOps);
  const { usuarios } = useUsuarios();
  // Sem filtro de rede (STC-510) de propósito: só resolve o nome de
  // qualquer unidade que uma permissão aponte (linha 302), nunca é um
  // dropdown -- uma permissão pode apontar pra uma unidade OPEX, e o nome
  // dela precisa continuar resolvendo normalmente aqui.
  const { unidades } = useUnidades();
  const { setores } = useSetores();
  const { recursos } = useRecursosPermissao();
  const { revogar, isLoading: revogando } = useRevogarPermissao();
  const { reativar, isLoading: reativando } = useReativarPermissao();
  const { tiposGestao, isLoading: carregandoTipos } = useTiposGestao();

  const [formAberto, setFormAberto] = useState(false);
  const [paraRevogar, setParaRevogar] = useState<PermissaoUsuario | null>(null);
  // Achado no dogfooding (pedido da Solicitante): "Reativar" uma permissão
  // revogada/expirada. Sem data de fim, religa o mesmo registro direto
  // (paraReativar); com data de fim, as datas antigas não servem mais pra
  // um período novo -- abre o formulário de nova permissão pré-preenchido
  // em vez disso (renovando), mantendo o registro velho como histórico de
  // que ele existiu e chegou a expirar/ser revogado.
  const [paraReativar, setParaReativar] = useState<PermissaoUsuario | null>(
    null,
  );
  const [renovando, setRenovando] = useState<PermissaoUsuario | null>(null);
  // Achado no dogfooding: com muitos usuários, "Perfil, unidade e setor"
  // (tabela sem paginação) empurrava "Permissões individuais" pra fora da
  // tela. null = as duas seções dividem a altura disponível proporcional ao
  // que cada uma tem (ver pesoSecao), cada uma com scroll próprio;
  // "usuarios"/"permissoes" = essa seção ocupa o espaço das duas, a outra
  // fica oculta (mas continua montada -- volta do jeito que estava ao
  // desfazer).
  const [secaoExpandida, setSecaoExpandida] = useState<Secao | null>(null);
  // STC-415: aba nova ("Catálogo de Legalização") ao lado do conteúdo que já
  // existia -- mesmo padrão de troca de conteúdo por state (não TabsContent)
  // já usado em TipoGestaoTabs.tsx.
  //
  // STC-519: aba é DERIVADA do pathname (rota própria pra cada uma --
  // /admin/permissoes vs. /admin/permissoes/catalogo-legalizacao -- ver
  // layout.tsx deste diretório de rota), não um useState com valor inicial
  // fixo. Duas rodadas de revisão de falhas críticas levaram até aqui:
  // (1) query string (?aba=) não dava pro Sidebar (pathname.startsWith(),
  // sem olhar query) distinguir este atalho do link "Administração" (mesmo
  // pathname bare), destacando "Catálogo de Legalização" como ativo mesmo
  // com Usuários na tela; (2) rota própria + abaInicial via prop resolvia
  // isso, mas cada navegação entre as duas rotas remontava o componente
  // inteiro (page.tsx diferente) -- perdendo filtros/seção expandida/
  // diálogos abertos ao trocar de aba pelo Select "Seção" (que já navega,
  // ver onValueChange abaixo). A saída: PermissoesAdmin passa a ser
  // renderizado pelo layout.tsx (persiste entre as duas rotas, nunca
  // desmonta) em vez de cada page.tsx, e lê o pathname direto -- sem
  // remount nenhum, e sem `useState`/prop pra manter sincronizado.
  const aba: Aba =
    (Object.keys(ROTA_ABA) as Aba[]).find(
      (candidata) => candidata !== "usuarios" && pathname.endsWith(ROTA_ABA[candidata]),
    ) ?? "usuarios";
  // Parâmetros de Gestão RH só buscam na API depois da primeira visita à seção.
  const [visitouGestaoRH, setVisitouGestaoRH] = useState(false);
  // Acessos, idem: só busca na primeira visita.
  const [visitouAcessos, setVisitouAcessos] = useState(false);

  function alternarExpansao(secao: Secao) {
    setSecaoExpandida((atual) => (atual === secao ? null : secao));
  }

  // Filtros -- só do lado do cliente: usePermissoes() já carrega tudo de
  // uma vez (sem paginação), então filtrar em memória é suficiente e evita
  // ir e voltar no backend a cada troca de filtro.
  const [filtroStatus, setFiltroStatus] = useState("todos");
  // Pessoa é multi-seleção (achado no dogfooding: útil comparar duas
  // pessoas de uma vez) -- array vazio = sem filtro, não "todas" como um
  // valor mágico, já que aqui não existe um "valor único" pra representar
  // isso.
  const [filtroPessoas, setFiltroPessoas] = useState<number[]>([]);
  const [filtroAcao, setFiltroAcao] = useState("todas");
  // Sem coluna escolhida, vale a ordem padrão (status, depois criação mais
  // recente, ver permissoesOrdenadas).
  const [ordenacaoPermissoes, setOrdenacaoPermissoes] =
    useState<Ordenacao<CampoPermissoes> | null>(null);

  // Status primeiro (Ativa/Agendada/Expirada/Revogada, ver prioridadeStatus),
  // criação mais recente primeiro como critério de desempate dentro do mesmo
  // status -- não como ordenação única. A API não garante ordenação por
  // criação, e cada registro permanece uma linha independente: timestamp
  // nunca deve funcionar como identidade de lote, pois concessões distintas
  // podem ocorrer no mesmo minuto.
  const permissoesOrdenadas = [...permissoes].sort((a, b) => {
    const diferencaStatus = prioridadeStatus(a) - prioridadeStatus(b);
    return diferencaStatus !== 0
      ? diferencaStatus
      : b.created_at.localeCompare(a.created_at);
  });
  // Peso das seções (ver pesoSecao) segue o total real, não o filtrado --
  // senão a proporção "pula" a cada troca de filtro, mesmo com a mesma
  // quantidade de dados por trás.
  const pesoUsuarios = pesoSecao(usuariosGerenciaveis(usuarios, user, unidades).length);
  const pesoPermissoes = pesoSecao(permissoesOrdenadas.length);
  // Achado no dogfooding: listar TODOS os usuários no filtro de pessoa
  // mostrava gente que nunca recebeu nenhuma permissão -- opções demais,
  // a maioria inútil. Deriva das permissões (não filtrado por outros campos
  // de propósito: trocar Status/Ação não deve fazer pessoas sumirem da
  // lista de opções, senão fica confuso qual filtro mexeu em qual).
  const idsComPermissao = Array.from(
    new Set(permissoesOrdenadas.map((permissao) => permissao.usuario)),
  ).sort((a, b) => nomeUsuario(a).localeCompare(nomeUsuario(b)));
  const permissoesFiltradas = permissoesOrdenadas.filter((permissao) => {
    if (
      filtroStatus !== "todos" &&
      statusPermissao(permissao).rotulo !== filtroStatus
    )
      return false;
    if (filtroPessoas.length > 0 && !filtroPessoas.includes(permissao.usuario))
      return false;
    if (filtroAcao !== "todas" && permissao.acao !== filtroAcao) {
      return false;
    }
    return true;
  });
  const contagemFiltrosPermissoes = [
    filtroStatus !== "todos",
    filtroPessoas.length > 0,
    filtroAcao !== "todas",
  ].filter(Boolean).length;

  function limparFiltrosPermissoes() {
    setFiltroStatus("todos");
    setFiltroPessoas([]);
    setFiltroAcao("todas");
  }

  function alternarFiltroPessoa(usuarioId: number) {
    setFiltroPessoas((atual) =>
      atual.includes(usuarioId)
        ? atual.filter((id) => id !== usuarioId)
        : [...atual, usuarioId],
    );
  }

  // Mesmo padrão de guarda de página usado em nenhum outro lugar do app
  // ainda (achado construindo o STC-266: hoje o controle de admin só
  // esconde pedaços de tela, nunca bloqueia uma página inteira) -- backend
  // (IsAdminOperacoes) continua sendo a fonte de verdade real, isso é só
  // pra não deixar a tela "piscar" vazia/quebrada pra quem não tem acesso.
  // Navegação dentro de useEffect, não direto no corpo do render -- fora
  // do effect, chamar router.replace() durante a renderização é efeito
  // colateral no lugar errado (React acusa "Cannot update a component
  // while rendering a different component"). carregandoAuth entra na
  // condição de propósito: isAdminOps nasce false antes da sessão
  // resolver, e sem essa checagem um Admin Operações de verdade seria
  // redirecionado por engano no primeiro render.
  useEffect(() => {
    if (!carregandoAuth && !confirmandoCargo && !podeAcessar) {
      router.replace("/modulos/gestao-demandas");
    }
  }, [carregandoAuth, confirmandoCargo, podeAcessar, router]);

  // Aba fora do acesso (Coordenador fora do Catálogo, Admin Operações
  // Especiais fora de Usuários): vale a primeira que ele tem, e a URL
  // acompanha, para o Select e a sidebar não divergirem do conteúdo.
  const abaEfetiva: Aba = abasPermitidas.includes(aba) ? aba : abasPermitidas[0];
  const rotaDaAbaEfetiva = abaEfetiva !== aba ? ROTA_ABA[abaEfetiva] : null;
  useEffect(() => {
    if (!carregandoAuth && !confirmandoCargo && podeAcessar && rotaDaAbaEfetiva) {
      router.replace(rotaDaAbaEfetiva);
    }
  }, [carregandoAuth, confirmandoCargo, podeAcessar, rotaDaAbaEfetiva, router]);

  // Aba pedida fora do acesso pela sessão: o cargo atual pode liberá-la, então
  // a tela espera em vez de mostrar outra aba com a URL desta.
  const aguardandoAba = confirmandoCargo && abaEfetiva !== aba;

  if (carregandoAuth || !podeAcessar || aguardandoAba) return null;
  if (abaEfetiva === "parametros-gestao-rh" && !visitouGestaoRH) setVisitouGestaoRH(true);
  if (abaEfetiva === "acessos" && !visitouAcessos) setVisitouAcessos(true);

  function nomeUsuario(usuarioId: number) {
    const usuario = usuarios.find((candidato) => candidato.id === usuarioId);
    return usuario ? nomeExibicao(usuario) : `Usuário #${usuarioId}`;
  }

  // STC-422: achado no dogfooding -- a tabela nunca mostrava qual
  // recurso/módulo cada permissão cobre (fazia sentido enquanto só existia
  // um recurso no sistema inteiro, deixou de fazer com um segundo módulo em
  // uso). Cai de volta pra chave crua se o recurso não estiver (mais) no
  // catálogo -- ex. uma permissão histórica de um recurso já removido --
  // pra não sumir a linha nem quebrar o render.
  function rotuloRecurso(chave: string) {
    const recurso = encontrarRecursoPorChave(recursos, chave);
    return recurso ? `${recurso.moduloNome} -- ${recurso.rotulo}` : chave;
  }

  // Tipos de outra rede não vêm em tipos-gestao para quem administra só uma.
  function nomesDosTipos(ids: number[]) {
    if (carregandoTipos) return "carregando...";
    return ids
      .map((id) => tiposGestao.find((tipo) => tipo.id === id)?.nome ?? "outro tipo")
      .join(", ");
  }

  function nomeEscopo(permissao: {
    escopo_tipo: EscopoPermissao;
    unidade: number | null;
    setor: number | null;
  }) {
    if (permissao.escopo_tipo === "unidade") {
      return (
        unidades.find((unidade) => unidade.id === permissao.unidade)?.nome ??
        "--"
      );
    }
    if (permissao.escopo_tipo === "setor") {
      return (
        setores.find((setor) => setor.id === permissao.setor)?.nome ?? "--"
      );
    }
    return ROTULO_ESCOPO[permissao.escopo_tipo];
  }

  const permissoesNaTabela = ordenarPor(permissoesFiltradas, ordenacaoPermissoes, {
    pessoa: (permissao) => nomeUsuario(permissao.usuario),
    recurso: (permissao) => rotuloRecurso(permissao.recurso),
    // Concedido em: a data da concessão (quem concedeu aparece embaixo).
    concedido: (permissao) => permissao.created_at,
    acao: (permissao) => ROTULO_ACAO[permissao.acao],
    escopo: (permissao) => nomeEscopo(permissao),
    periodo: (permissao) => permissao.data_inicio,
    // Na ordem dos status (Ativa, Agendada, Expirada, Revogada), não alfabética.
    status: (permissao) => prioridadeStatus(permissao),
  });

  async function confirmarRevogacao() {
    if (!paraRevogar) return;
    try {
      await revogar(paraRevogar.id);
      toast.success("Permissão revogada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setParaRevogar(null);
    }
  }

  async function confirmarReativacao() {
    if (!paraReativar) return;
    try {
      await reativar(paraReativar.id);
      toast.success("Permissão reativada.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setParaReativar(null);
    }
  }

  // "acao" só aceita visualizar/editar em permissão nova (ver ACOES em
  // FormNovaPermissao.tsx) -- um registro antigo com outra ação (de antes
  // dessa restrição existir) cai em "visualizar" por padrão, não trava a
  // renovação.
  function valoresParaRenovar(
    permissao: PermissaoUsuario,
  ): ValoresIniciaisPermissao {
    return {
      usuario: permissao.usuario,
      recurso: permissao.recurso,
      acao:
        permissao.acao === "visualizar" || permissao.acao === "editar"
          ? permissao.acao
          : "visualizar",
      escopo_tipo: permissao.escopo_tipo,
      unidade: permissao.unidade ?? undefined,
      setor: permissao.setor ?? undefined,
      // Global de uma rede só continua dessa rede; sem rede, as duas.
      rede: permissao.escopo_tipo === "global" ? (permissao.rede ?? "ambas") : undefined,
      tipos_gestao: permissao.tipos_gestao ?? [],
    };
  }

  // Extraído pra função (não JSX inline duas vezes): os mesmos 3 selects
  // renderizam inline (desktop) ou dentro do Popover (mobile), mesmo
  // critério do KanbanFiltros -- reaproveita a árvore em vez de duplicar
  // <Select>/aria-label nos dois branches.
  function camposDeFiltroPermissoes() {
    return (
      <>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_PERMISSAO.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Multi-seleção: mesmo padrão do campo "Ação" em FormNovaPermissao
            (Popover + Checkbox, estilizado feito um SelectTrigger) -- o
            primitivo Select do Radix não suporta múltiplos valores. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Pessoa"
              className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto dark:bg-input/30 dark:hover:bg-input/50"
            >
              <span
                className={cn(
                  "line-clamp-1 text-left",
                  filtroPessoas.length === 0 && "text-muted-foreground",
                )}
              >
                {filtroPessoas.length > 0
                  ? filtroPessoas.map((id) => nomeUsuario(id)).join(", ")
                  : "Pessoa"}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground opacity-50" />
            </button>
          </PopoverTrigger>
          {/* min-w: achado no dogfooding -- preso só a
              --radix-popover-trigger-width, o botão "Pessoa" (estreito
              antes de escolher alguém) fazia nomes mais longos ("Projetos
              BR MED") quebrarem linha dentro do popover e "descolarem" do
              checkbox. shrink-0 no Checkbox + truncate no texto garantem
              uma linha só mesmo assim. */}
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-48 p-1"
          >
            {idsComPermissao.map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={filtroPessoas.includes(id)}
                  onCheckedChange={() => alternarFiltroPessoa(id)}
                  className="shrink-0"
                />
                <span className="truncate">{nomeUsuario(id)}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Select value={filtroAcao} onValueChange={setFiltroAcao}>
          <SelectTrigger
            size="sm"
            className="h-8 w-full sm:w-auto"
            aria-label="Ação"
          >
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {(Object.keys(ROTULO_ACAO) as AcaoPermissao[]).map((acao) => (
              <SelectItem key={acao} value={acao}>
                {ROTULO_ACAO[acao]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contagemFiltrosPermissoes > 0 && (
          <button
            type="button"
            onClick={limparFiltrosPermissoes}
            className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-7">
      {/* Select (não abas) na mesma linha do título -- achado no
          dogfooding: com abas, cada seção nova precisa de mais largura
          própria; um select cresce em altura (1 opção a mais na lista), não
          em largura, então não sobrecarrega o cabeçalho quando uma 3ª seção
          aparecer. Sem subtítulo -- "Administração" já é suficiente. */}
      <div className="flex flex-col gap-2 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 shrink-0 text-secondary" />
          <h1 className="text-lg font-semibold text-foreground">
            {apenasCatalogo ? ROTULO_ABA["catalogo-legalizacao"] : "Administração"}
          </h1>
        </div>

        {/* Sem Select nenhum pro Coordenador -- só 1 aba (Catálogo de
            Legalização) faz parte do acesso dele, não tem entre o quê
            escolher. */}
        {!apenasCatalogo && (
          <Select
            value={abaEfetiva}
            onValueChange={(valor) => {
              // STC-519: aba é derivada do pathname (ver comentário acima),
              // então só navegar já basta -- sem remount (PermissoesAdmin
              // vive no layout.tsx, não em cada page.tsx), a sidebar e o
              // conteúdo desta tela atualizam juntos a partir do mesmo
              // pathname, sem perder nenhum outro state (filtros, seção
              // expandida, diálogos abertos). replace (não push): é troca
              // de aba, não deveria empilhar no histórico do back-button a
              // cada clique no Select.
              router.replace(ROTA_ABA[valor as Aba]);
            }}
          >
            <SelectTrigger aria-label="Seção" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {abasPermitidas.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {ROTULO_ABA[valor]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {visitouAcessos && <AcessosAdmin hidden={abaEfetiva !== "acessos"} />}

      {abasPermitidas.includes("catalogo-legalizacao") && (
        <CatalogoLegalizacaoAdmin hidden={abaEfetiva !== "catalogo-legalizacao"} />
      )}

      {/* Parâmetros de Gestão RH: só Admin (a API também recusa com 403).
          Monta na primeira visita à seção, não em toda entrada na
          Administração; depois fica só escondida, para não perder edição. */}
      {administraRedePadrao && visitouGestaoRH && (
        <ParametrosGestaoRHAdmin hidden={abaEfetiva !== "parametros-gestao-rh"} />
      )}

      {/* Cada seção reparte a altura disponível proporcional a quantas
          linhas tem (flex-grow via style, ver pesoSecao) e rola por conta
          própria -- uma tabela grande nunca empurra a outra seção pra fora
          da tela, e uma seção rala não fica com metade da tela vazia.
          min-h-[20rem] (não min-h-0): achado no dogfooding -- com uma
          diferença grande de linhas (ex.: 2 vs 19), o peso proporcional
          sozinho espremia a seção menor abaixo da altura do próprio
          cabeçalho (só sobrava espaço pro <thead>, nem uma linha). O piso
          garante cabeçalho + ~2 linhas visíveis antes de precisar rolar,
          não importa quão desigual seja a proporção; o espaço extra além
          dos dois pisos continua sendo repartido pelo peso. Subiu de
          15rem pra 20rem quando os filtros (Status/Pessoa/Ação,
          Perfil/Unidade) ganharam sua própria linha em cada seção --
          cabeçalho + filtro + <thead> já comiam quase todo o piso antigo,
          sobrando espaço de menos que 1 linha de dado de verdade.
          Expandida, uma toma o espaço das duas e a outra leva "hidden"
          (fica montada, só invisível: preserva scroll/estado ao desfazer).
          min-w-0 em toda a cadeia: achado testando em telas estreitas -- a
          tabela de dentro tem min-w-[Npx] pra rolar horizontalmente (mesmo
          princípio do Kanban, STC-186), mas sem min-w-0 esse mínimo
          "vaza" pro pai (mesmo bug do min-height:auto que motivou o
          min-h-0 acima, só que no eixo horizontal) e empurra a coluna
          inteira mais larga que a viewport -- o cabeçalho quebra
          palavra-por-palavra e a página ganha scroll horizontal fantasma.

          overflow-y-auto sm:overflow-visible: achado testando em celular
          real (STC-505) -- faltava aqui o mesmo fallback que
          CatalogoLegalizacaoAdmin.tsx já tinha. No mobile, as duas tabelas
          abaixo abrem mão da própria altura travada (ver GerenciarUsuarios.tsx/
          o bloco de Permissões individuais) -- sem um scroll no nível da
          aba pra herdar esse conteúdo "solto", não haveria como alcançar o
          que não coubesse na tela. Desktop mantém sm:overflow-visible (cada
          tabela rola por conta própria, como já documentado acima). */}
      {/* Usuários/Permissões individuais continuam Admin-only (STC-514) --
          nunca renderiza pro Coordenador, não só escondido via `hidden`. */}
      {!apenasCatalogo && (
        <div
          hidden={abaEfetiva !== "usuarios"}
          className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-7 overflow-y-auto sm:overflow-visible"
        >
          <div
            data-testid="secao-usuarios"
            className={cn(
              "flex min-h-[20rem] min-w-0 flex-col",
              secaoExpandida === "permissoes" ? "hidden" : "flex-1",
            )}
            style={{ flexGrow: pesoUsuarios }}
          >
            {/* STC-266 (extensão): a tela nasceu só com PermissaoUsuario
                (acessos extras pontuais). Faltava a parte "estrutural" --
                Perfil/Unidade/Setor da pessoa -- que hoje só existia no
                Django Admin, mesmo o backend (UsuarioViewSet) já aceitando
                Admin Operações editar isso via API. */}
            <GerenciarUsuarios
              expandido={secaoExpandida === "usuarios"}
              onAlternarExpandir={() => alternarExpansao("usuarios")}
            />
          </div>

          {secaoExpandida === null && <div className="h-px shrink-0 bg-border" />}

          <div
            ref={refSecaoPermissoes}
            data-testid="secao-permissoes"
            className={cn(
              "flex min-h-[20rem] min-w-0 flex-col",
              secaoExpandida === "usuarios" ? "hidden" : "flex-1",
            )}
            style={{ flexGrow: pesoPermissoes }}
          >
            <div className="pb-2">
              <h2 className="text-base font-semibold text-foreground">
                Permissões individuais
              </h2>
              <p className="text-sm text-muted-foreground">
                Acesso extra a um recurso específico -- temporário ou não -- ex.:
                cobertura de férias entre unidades.
              </p>
            </div>

            {/* Achado no dogfooding: filtros e botões numa linha só (não
                cabeçalho+botões numa linha e filtros noutra) -- mesmo
                critério do KanbanFiltros (o "Nova Demanda" mora na própria
                linha dos filtros, não no cabeçalho da página) e economiza
                uma linha inteira de altura, principalmente em mobile. */}
            <div className="flex flex-wrap items-center gap-2 pb-3">
              {!carregandoPermissoes &&
                permissoesOrdenadas.length > 0 &&
                (ehMobile ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="relative shrink-0"
                      >
                        <ListFilter className="size-4" />
                        <span className="sr-only">Filtros</span>
                        {contagemFiltrosPermissoes > 0 && (
                          <Badge
                            variant="secondary"
                            className="absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]"
                          >
                            {contagemFiltrosPermissoes}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="flex flex-col gap-2">
                      {camposDeFiltroPermissoes()}
                    </PopoverContent>
                  </Popover>
                ) : (
                  camposDeFiltroPermissoes()
                ))}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button onClick={() => setFormAberto(true)}>
                  <Plus className="size-4" />
                  Nova permissão
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => alternarExpansao("permissoes")}
                  aria-label={
                    secaoExpandida === "permissoes"
                      ? "Recolher Permissões individuais"
                      : "Expandir Permissões individuais"
                  }
                >
                  {secaoExpandida === "permissoes" ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {carregandoPermissoes ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : permissoesOrdenadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma permissão concedida ainda.
              </p>
            ) : permissoesFiltradas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma permissão encontrada com esses filtros.
              </p>
            ) : (
              // ehMobile ? undefined : {...} / !ehMobile && "overflow-y-auto":
              // mesmo achado de GerenciarUsuarios.tsx (STC-505) -- sem isso, a
              // tabela travava a própria altura mesmo no mobile, sem sobrar
              // espaço nem scroll de página pra compensar.
              <div
                ref={refTabelaPermissoes}
                style={ehMobile ? undefined : { maxHeight: alturaTabelaPermissoes }}
                className={cn(
                  "scrollbar-discreta scroll-fade-x min-h-0 min-w-0 flex-1 overflow-x-auto rounded-lg border border-border",
                  !ehMobile && "overflow-y-auto",
                )}
              >
                <table
                  aria-label="Permissões individuais"
                  className="w-full min-w-[720px] text-left text-sm"
                >
                  {/* sticky: achado no dogfooding (pedido testando com muitas
                      permissões) -- sem isso, rolar a tabela escondia os
                      rótulos das colunas junto com as linhas. bg-muted sólido
                      (não /40): um header sticky translúcido deixaria as
                      linhas por baixo aparecerem por trás dele ao rolar. */}
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {/* sticky left-0: achado testando no mobile (STC-505) --
                          8 colunas (a mais densa das 3 tabelas de admin)
                          deixavam a tela cheia de scroll horizontal sem
                          contexto de qual linha é qual. Mesmo tratamento de
                          GerenciarUsuarios.tsx/TabelaTiposDocumento.tsx -- ver
                          comentário lá pro racional completo do bg/z-index. */}
                      {COLUNAS_PERMISSOES.map((coluna) => (
                        <CabecalhoOrdenavel
                          key={coluna.campo}
                          campo={coluna.campo}
                          rotulo={coluna.rotulo}
                          ordenacao={ordenacaoPermissoes}
                          onOrdenar={(campo) =>
                            setOrdenacaoPermissoes((atual) => proximaOrdenacao(atual, campo))
                          }
                          className={cn(
                            "px-4 py-2.5",
                            coluna.campo === "pessoa" && "sticky left-0 z-20 bg-muted",
                          )}
                        />
                      ))}
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {permissoesNaTabela.map((permissao) => {
                      const status = statusPermissao(permissao);
                      return (
                        <tr
                          key={permissao.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="sticky left-0 z-[1] bg-background px-4 py-2.5 font-medium text-foreground">
                            {nomeUsuario(permissao.usuario)}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {rotuloRecurso(permissao.recurso)}
                          </td>
                          {/* Achado no dogfooding: faltava rastro de quem
                              concedeu e quando -- só o período de validade não
                              basta pra auditoria ("quem deu esse acesso pra
                              ela?"). */}
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <div>{nomeUsuario(permissao.concedido_por)}</div>
                            <div className="text-xs">
                              {formatarDataHora(permissao.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {ROTULO_ACAO[permissao.acao]}
                          </td>
                          <td className="px-4 py-2.5">
                            {ROTULO_ESCOPO[permissao.escopo_tipo]}
                            {permissao.escopo_tipo === "global" && permissao.rede && (
                              <span className="text-muted-foreground">
                                {" -- "}
                                {ROTULO_REDE[permissao.rede]}
                              </span>
                            )}
                            {permissao.escopo_tipo !== "global" &&
                              permissao.escopo_tipo !== "proprio" && (
                                <span className="text-muted-foreground">
                                  {" -- "}
                                  {nomeEscopo(permissao)}
                                </span>
                              )}
                            {(permissao.tipos_gestao?.length ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Tipos: {nomesDosTipos(permissao.tipos_gestao ?? [])}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {permissao.data_fim
                              ? `${formatarData(permissao.data_inicio)} até ${formatarData(permissao.data_fim)}`
                              : `A partir de ${formatarData(permissao.data_inicio)}`}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={status.variante}>
                              {status.rotulo}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              {/* Achado no dogfooding: permissao.ativo sozinho
                                  também é true pra "Expirada" (a data que
                                  passou, não o campo ativo) -- Revogar não faz
                                  sentido nenhum ali, já não vale de qualquer
                                  jeito. Só aparece pro que ainda está de pé
                                  (Ativa/Agendada). */}
                              {(status.rotulo === "Ativa" ||
                                status.rotulo === "Agendada") && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setParaRevogar(permissao)}
                                >
                                  Revogar
                                </Button>
                              )}
                              {(status.rotulo === "Revogada" ||
                                status.rotulo === "Expirada") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  // Cor puxa pro verde do badge "Ativa" (--chart-3)
                                  // -- achado no dogfooding: Revogar/Reativar com
                                  // a mesma cor cinza + nomes parecidos confundia
                                  // visualmente qual botão fazia o quê.
                                  className="border-chart-3/40 text-chart-3 hover:bg-chart-3/10 hover:text-chart-3"
                                  onClick={() =>
                                    // Sem data de fim, religa o mesmo registro
                                    // direto -- com data de fim, as datas velhas
                                    // não servem mais, abre o formulário
                                    // pré-preenchido pra um período novo.
                                    permissao.data_fim
                                      ? setRenovando(permissao)
                                      : setParaReativar(permissao)
                                  }
                                >
                                  Reativar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <FormNovaPermissao
        open={formAberto || renovando !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormAberto(false);
            setRenovando(null);
          }
        }}
        valoresIniciais={renovando ? valoresParaRenovar(renovando) : undefined}
      />

      <ConfirmDialog
        open={paraRevogar !== null}
        onOpenChange={(open) => !open && setParaRevogar(null)}
        titulo="Revogar permissão"
        descricao={
          paraRevogar
            ? `Revogar o acesso de ${nomeUsuario(
                paraRevogar.usuario,
              )}? Isso desativa a permissão imediatamente.`
            : ""
        }
        textoConfirmar="Revogar"
        destrutivo
        isLoading={revogando}
        onConfirmar={() => void confirmarRevogacao()}
      />

      <ConfirmDialog
        open={paraReativar !== null}
        onOpenChange={(open) => !open && setParaReativar(null)}
        titulo="Reativar permissão"
        descricao={
          paraReativar
            ? `Reativar o acesso de ${nomeUsuario(paraReativar.usuario)}? Isso vale a partir de agora, sem precisar de uma nova concessão.`
            : ""
        }
        textoConfirmar="Reativar"
        isLoading={reativando}
        onConfirmar={() => void confirmarReativacao()}
      />
    </div>
  );
}
